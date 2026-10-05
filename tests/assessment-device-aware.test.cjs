/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolveAtlasAlias(request, parent, isMain, options) {
  return originalResolve.call(this, request.startsWith("@/") ? path.join(root, request.slice(2)) : request, parent, isMain, options);
};
require.extensions[".ts"] = function transpileTypeScript(module, filename) {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { getMockAssessment } = require("../adapters/mock/assessment.ts");
const { applicableQuestions, assessmentComplete, assessmentProgress, pruneAnswers } = require("../lib/assessment.ts");

const device = (id, category, brand, model, network, stylus = false) => ({
  id, category, brand, model, specs: { network }, capabilities: { stylus }, createdAt: "2026-09-28T00:00:00.000Z",
});
const ipad = device("device-ipad-air-m3-11", "tablet", "Apple", "iPad Air 11-inch (M3)", "Wi-Fi", true);
const cellularIpad = { ...ipad, specs: { network: "Wi-Fi + Cellular" } };
const otherTablet = device("device-other-tablet", "tablet", "Xiaomi", "Pad", "Wi-Fi");
const macbook = device("device-macbook-air-m1-2020", "laptop", "Apple", "MacBook Air (M1, 2020)");
const imac = device("device-imac-m4-24", "desktop", "Apple", "iMac (M4, 24-inch)");
const mini = device("device-mac-mini-m4", "desktop", "Apple", "Mac mini (M4)");

function answer(questionId, optionId) {
  return { questionId, value: { kind: "choice", optionId }, answeredAt: "2026-09-28T00:00:00.000Z" };
}

function completeAnswers(definition, selected) {
  const answers = [answer("device_powers_on", "yes")];
  const defaults = { repair_or_parts_replaced: "no", organization_owned_or_managed: "no" };
  for (const question of applicableQuestions(definition, selected, answers)) {
    if (question.id === "device_powers_on") continue;
    if (question.type === "multi") {
      answers.push({
        questionId: question.id,
        value: { kind: "multi", optionIds: [question.id === "included_accessories" ? "none" : "unknown"] },
        answeredAt: "2026-09-28T00:00:00.000Z",
      });
    } else {
      answers.push(answer(question.id, defaults[question.id] ?? question.options[0].id));
    }
  }
  return answers;
}

test("new assessments have ordered, unique questions and substantial category coverage", () => {
  for (const selected of [ipad, otherTablet, macbook, imac, mini]) {
    const definition = getMockAssessment(selected);
    const ids = definition.questions.map((question) => question.id);
    const groups = definition.questions.map((question) => question.groupId);
    const transitions = groups.filter((group, index) => index === 0 || group !== groups[index - 1]);
    const sectionIds = new Set(definition.sections.map((section) => section.id));
    assert.ok(ids.length >= 25, selected.id);
    assert.equal(new Set(ids).size, ids.length, selected.id);
    assert.equal(new Set(groups).size, transitions.length, selected.id);
    definition.questions.forEach((question, index) => {
      assert.ok(sectionIds.has(question.sectionId), question.id);
      for (const rule of [...(question.visibleWhen?.all ?? []), ...(question.visibleWhen?.any ?? [])]) {
        assert.ok(ids.indexOf(rule.questionId) >= 0 && ids.indexOf(rule.questionId) < index, question.id);
      }
    });
    assert.ok(["tablet", "macbook", "desktop"].includes(definition.coverage));
  }
});

test("tablet questions respond to selected connectivity and verified stylus capability", () => {
  const ids = (selected) => applicableQuestions(getMockAssessment(selected), selected, [answer("device_powers_on", "yes")]).map((question) => question.id);
  assert.ok(ids(ipad).includes("stylus_works"));
  assert.ok(!ids(ipad).includes("cellular_works"));
  assert.ok(ids(cellularIpad).includes("cellular_works"));
  assert.ok(!ids(otherTablet).includes("stylus_works"));
  assert.ok(!ids(otherTablet).includes("cellular_works"));

  const definition = getMockAssessment(cellularIpad);
  const stale = [answer("device_powers_on", "yes"), answer("cellular_works", "yes")];
  assert.ok(pruneAnswers(definition, cellularIpad, stale).some((item) => item.questionId === "cellular_works"));
  assert.ok(!pruneAnswers(getMockAssessment(ipad), ipad, stale).some((item) => item.questionId === "cellular_works"));
  assert.ok(!applicableQuestions(definition, cellularIpad, [answer("device_powers_on", "no")]).some((question) => question.id === "cellular_works"));
});

test("MacBook includes integrated input and battery checks; desktop questions follow built-in hardware", () => {
  const ids = (selected) => applicableQuestions(getMockAssessment(selected), selected, [answer("device_powers_on", "yes")]).map((question) => question.id);
  const bookIds = ids(macbook);
  for (const id of ["keyboard_works", "trackpad_works", "touch_id_works", "battery_holds_charge", "charging_works"]) {
    assert.ok(bookIds.includes(id), id);
  }
  const imacIds = ids(imac);
  for (const id of ["built_in_display_works", "camera_works", "microphones_work", "speakers_work"]) {
    assert.ok(imacIds.includes(id), id);
  }
  const miniIds = ids(mini);
  for (const id of ["built_in_display_works", "camera_works", "microphones_work", "speakers_work", "keyboard_works", "trackpad_works", "battery_holds_charge"]) {
    assert.ok(!miniIds.includes(id), id);
  }
  assert.ok(miniIds.includes("external_display_output_works"));
  assert.ok(miniIds.includes("power_stability"));
  const repairOptions = (selected) => getMockAssessment(selected).questions.find((question) => question.id === "repaired_components").options.map((option) => option.id);
  assert.ok(repairOptions(imac).includes("display"));
  assert.ok(!repairOptions(imac).includes("battery"));
  assert.ok(!repairOptions(mini).includes("display"));
  assert.ok(!repairOptions(mini).includes("battery"));
});

test("completion and progress account for visible repair and organization branches", () => {
  for (const selected of [cellularIpad, macbook, imac, mini]) {
    const definition = getMockAssessment(selected);
    const base = completeAnswers(definition, selected);
    assert.equal(assessmentComplete(definition, selected, base), true, selected.id);
    const repair = base.map((item) => item.questionId === "repair_or_parts_replaced" ? answer(item.questionId, "yes") : item);
    assert.equal(assessmentComplete(definition, selected, repair), false, selected.id);
    assert.ok(assessmentProgress(definition, selected, repair, null).total > assessmentProgress(definition, selected, base, null).total);
    assert.ok(applicableQuestions(definition, selected, repair).some((question) => question.id === "repaired_components"));
    assert.ok(!pruneAnswers(definition, selected, base.concat([
      { questionId: "repaired_components", value: { kind: "multi", optionIds: ["display"] }, answeredAt: "2026-09-28T00:00:00.000Z" },
    ])).some((item) => item.questionId === "repaired_components"));
  }
});

test("organization and accessory answers are pruned when their parent choice changes", () => {
  const definition = getMockAssessment(macbook);
  const managed = [
    answer("organization_owned_or_managed", "yes"),
    answer("organization_release_ready", "yes"),
  ];
  assert.ok(applicableQuestions(definition, macbook, managed).some((question) => question.id === "organization_release_ready"));
  const unmanaged = [answer("organization_owned_or_managed", "no"), managed[1]];
  assert.ok(!pruneAnswers(definition, macbook, unmanaged).some((item) => item.questionId === "organization_release_ready"));

  const withCharger = [
    { questionId: "included_accessories", value: { kind: "multi", optionIds: ["charger_or_power_cord"] }, answeredAt: "2026-09-28T00:00:00.000Z" },
    answer("included_accessories_work", "yes"),
  ];
  assert.ok(applicableQuestions(definition, macbook, withCharger).some((question) => question.id === "included_accessories_work"));
  const noAccessories = [
    { ...withCharger[0], value: { kind: "multi", optionIds: ["none"] } },
    withCharger[1],
  ];
  assert.ok(!pruneAnswers(definition, macbook, noAccessories).some((item) => item.questionId === "included_accessories_work"));
});
