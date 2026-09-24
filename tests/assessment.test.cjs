/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const originalResolve = Module._resolveFilename;
const originalTsLoader = require.extensions[".ts"];

// Keep the test independent of Next's compiler while exercising the source modules.
Module._resolveFilename = function resolveAtlasAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolve.call(this, path.join(root, request.slice(2)), parent, isMain, options);
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
require.extensions[".ts"] = function transpileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const assessment = require("../lib/assessment.ts");
const { getMockAssessment } = require("../adapters/mock/assessment.ts");
const session = require("../lib/valuation-session.ts");
const { MockValuationService } = require("../adapters/mock/valuation.ts");
const { mockDevices } = require("../adapters/mock/devices.ts");

test.after(() => {
  Module._resolveFilename = originalResolve;
  require.extensions[".ts"] = originalTsLoader;
});

const iphone = mockDevices.find((device) => device.id === "device-iphone-15-pro");
const samsung = mockDevices.find((device) => device.id === "device-samsung-s24-ultra");
const macbook = mockDevices.find((device) => device.id === "device-macbook-air-m3");
const definition = getMockAssessment(iphone);
const answer = (questionId, value) => ({ questionId, value, answeredAt: "2026-09-22T00:00:00.000Z" });
const choice = (questionId, optionId) => answer(questionId, { kind: "choice", optionId });

function completeIphoneAnswers(overrides = {}) {
  return definition.questions
    .filter((question) => question.required)
    .filter((question) => question.id !== "repaired_components" || (overrides.repair_or_parts_replaced ?? "no") === "yes")
    .filter((question) => !["display_replacement_provenance", "battery_replacement_provenance", "camera_replacement_provenance", "other_repair_details_known"].includes(question.id))
    .map((question) => {
      const optionId = overrides[question.id] ?? (question.type === "multi" ? ["display"] : question.type === "single" ? "none" : "no");
      return question.type === "multi"
        ? answer(question.id, { kind: "multi", optionIds: optionId })
        : choice(question.id, optionId);
    });
}

function memoryWindow(initial) {
  const entries = new Map(initial ? [["atlast.valuation.session", JSON.stringify(initial)]] : []);
  return { sessionStorage: { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: (key) => entries.delete(key) }, entries };
}

test("validates required and optional values, numeric bounds and integer rules", () => {
  const required = definition.questions.find((question) => question.id === "device_powers_on");
  const battery = definition.questions.find((question) => question.id === "battery_health_percentage");
  assert.equal(assessment.answerError(required, undefined), "กรุณาตอบคำถามนี้");
  assert.equal(assessment.answerError(battery, undefined), null);
  assert.equal(assessment.answerError(battery, { kind: "skipped" }), null);
  assert.equal(assessment.answerError(battery, { kind: "unknown" }), null);
  assert.equal(assessment.answerError(battery, { kind: "number", value: 0 }), null);
  assert.equal(assessment.answerError(battery, { kind: "number", value: 100 }), null);
  assert.ok(assessment.answerError(battery, { kind: "number", value: -1 }));
  assert.ok(assessment.answerError(battery, { kind: "number", value: 80.5 }));
  assert.ok(assessment.answerError(battery, { kind: "number", value: 101 }));
  assert.ok(assessment.answerError(battery, { kind: "number", value: Number.NaN }));
  assert.ok(assessment.answerError(battery, { kind: "number", value: Infinity }));
  assert.equal(assessment.answerError(battery, { kind: "number", value: 80 }), null);
});

test("choice IDs must be catalog IDs and multi-select honours exclusivity", () => {
  const power = definition.questions.find((question) => question.id === "device_powers_on");
  const repaired = definition.questions.find((question) => question.id === "repaired_components");
  assert.ok(assessment.answerError(power, { kind: "choice", optionId: "ใช่" }));
  assert.ok(assessment.answerError(repaired, { kind: "multi", optionIds: ["display", "unknown"] }));
  assert.ok(assessment.answerError(repaired, { kind: "multi", optionIds: ["display", "display"] }));
  assert.equal(assessment.answerError(repaired, { kind: "multi", optionIds: ["camera", "battery"] }), null);
});

test("conditional branches prune invalid parents and cascade removed answers", () => {
  const branchAnswers = [
    choice("repair_or_parts_replaced", "yes"),
    answer("repaired_components", { kind: "multi", optionIds: ["display"] }),
    choice("display_replacement_provenance", "used"),
  ];
  assert.deepEqual(assessment.applicableQuestions(definition, iphone, branchAnswers).filter((q) => q.id.includes("replacement")).map((q) => q.id), ["display_replacement_provenance"]);
  const removedParent = [
    choice("repair_or_parts_replaced", "no"),
    answer("repaired_components", { kind: "multi", optionIds: ["display"] }),
    choice("display_replacement_provenance", "used"),
  ];
  assert.deepEqual(assessment.pruneAnswers(definition, iphone, removedParent).map((item) => item.questionId), ["repair_or_parts_replaced"]);
  const invalidParent = [
    choice("repair_or_parts_replaced", "not-a-choice"),
    answer("repaired_components", { kind: "multi", optionIds: ["display"] }),
    choice("display_replacement_provenance", "used"),
  ];
  assert.deepEqual(assessment.pruneAnswers(definition, iphone, invalidParent), []);
});

test("battery provenance respects explicit battery status and prunes stale branches", () => {
  const applicableIds = (answers) => assessment.applicableQuestions(definition, iphone, answers).map((question) => question.id);
  const repairedBattery = [choice("repair_or_parts_replaced", "yes"), answer("repaired_components", { kind: "multi", optionIds: ["battery"] })];
  assert.ok(!applicableIds([choice("battery_replaced", "no"), ...repairedBattery]).includes("battery_replacement_provenance"));
  assert.ok(applicableIds([choice("battery_replaced", "yes"), choice("repair_or_parts_replaced", "no")]).includes("battery_replacement_provenance"));
  assert.ok(applicableIds([choice("battery_replaced", "unknown"), ...repairedBattery]).includes("battery_replacement_provenance"));

  const previous = [choice("battery_replaced", "yes"), ...repairedBattery, choice("battery_replacement_provenance", "used")];
  const changed = [choice("battery_replaced", "no"), ...repairedBattery, choice("battery_replacement_provenance", "used")];
  assert.ok(assessment.pruneAnswers(definition, iphone, previous).some((item) => item.questionId === "battery_replacement_provenance"));
  assert.ok(!assessment.pruneAnswers(definition, iphone, changed).some((item) => item.questionId === "battery_replacement_provenance"));
});

test("assessment fixtures have stable, ordered schema and conservative model coverage", () => {
  const fixtureDefinitions = [definition, getMockAssessment(samsung)];
  for (const fixture of fixtureDefinitions) {
    const questionIds = fixture.questions.map((question) => question.id);
    assert.equal(new Set(questionIds).size, questionIds.length, `${fixture.id} question IDs must be unique`);
    const sectionIds = new Set(fixture.sections.map((section) => section.id));
    const groups = fixture.questions.map((question) => question.groupId);
    const transitions = groups.filter((group, index) => index === 0 || group !== groups[index - 1]);
    assert.equal(new Set(groups).size, transitions.length, `${fixture.id} groups must be contiguous`);
    fixture.questions.forEach((question, index) => {
      assert.ok(sectionIds.has(question.sectionId), `${question.id} belongs to a defined section`);
      if ("options" in question) {
        const optionIds = question.options.map((option) => option.id);
        assert.equal(new Set(optionIds).size, optionIds.length, `${question.id} option IDs must be unique`);
      }
      for (const rule of [...(question.visibleWhen?.all ?? []), ...(question.visibleWhen?.any ?? [])]) {
        assert.ok(questionIds.indexOf(rule.questionId) >= 0 && questionIds.indexOf(rule.questionId) < index,
          `${question.id} must reference an earlier question`);
      }
    });
  }
  for (const device of mockDevices) {
    const deviceDefinition = getMockAssessment(device);
    const isCurrentIphone = device.category === "phone" && device.brand === "Apple" && device.model.startsWith("iPhone");
    assert.equal(deviceDefinition.coverage, isCurrentIphone ? "iphone" : "basic", `${device.id} gets the correct fixture`);
    assert.deepEqual(deviceDefinition.features, isCurrentIphone ? ["face_id", "wireless_charging"] : []);
  }
  const unrecognizedIphone = { ...iphone, id: "device-iphone-future", model: "iPhone Future" };
  assert.deepEqual(getMockAssessment(unrecognizedIphone).features, []);
});

test("applies feature and category-specific questions and requires every visible required answer", () => {
  const iphoneIds = assessment.applicableQuestions(definition, iphone, [
    choice("device_powers_on", "yes"),
    choice("device_usable_normally", "no"),
  ]).map((question) => question.id);
  const basic = getMockAssessment(samsung);
  const samsungIds = assessment.applicableQuestions(basic, samsung, []).map((question) => question.id);
  assert.ok(iphoneIds.includes("face_id_works"));
  assert.ok(iphoneIds.includes("wireless_charging_works"));
  assert.ok(!iphoneIds.includes("touch_id_works"));
  assert.ok(!assessment.applicableQuestions(definition, iphone, [choice("device_powers_on", "no")]).some((question) => question.id === "face_id_works"));
  assert.deepEqual(samsungIds, ["device_powers_on", "exterior_condition", "device_functions_normally"]);
  assert.equal(assessment.assessmentComplete(definition, iphone, completeIphoneAnswers()), true);
  assert.equal(assessment.assessmentComplete(definition, iphone, completeIphoneAnswers().slice(1)), false);
  assert.equal(assessment.assessmentComplete(definition, iphone, [...completeIphoneAnswers(), answer("battery_health_percentage", { kind: "number", value: 101 })]), false);
});

test("new assessment retains legacy answers, keeps its session ID, and resets downstream pricing", () => {
  const stored = {
    device: iphone,
    session: { id: "legacy-session", status: "estimated", deviceId: iphone.id, conditionAnswers: [{ questionId: "legacy", questionText: "legacy", answer: "good", normalizedScore: 1, weight: 1, answeredAt: "old" }], expectedPrice: { amount: 20000, currency: "THB", enteredBy: "seller", source: "manual_entry", createdAt: "old" }, estimatedPrice: { amount: 20000 }, createdAt: "old", updatedAt: "old" },
  };
  global.window = memoryWindow(stored);
  const updated = session.saveAssessmentAnswers(definition, completeIphoneAnswers(), true);
  assert.equal(updated.session.id, "legacy-session");
  assert.equal(updated.session.status, "condition_completed");
  assert.deepEqual(updated.session.conditionAnswers, stored.session.conditionAnswers);
  assert.equal(updated.session.expectedPrice, undefined);
  assert.equal(updated.session.estimatedPrice, undefined);
  assert.equal(session.hasCompletedAssessment(updated), true);
  const unreviewed = { ...updated, session: { ...updated.session, assessment: { ...updated.session.assessment } } };
  delete unreviewed.session.assessment.reviewedAt;
  assert.equal(session.hasCompletedAssessment(unreviewed), false);
});

test("unchanged reviewed answers preserve later status; a changed answer clears it", () => {
  global.window = memoryWindow({ device: iphone, session: { id: "independent-session", deviceId: iphone.id, status: "device_selected", conditionAnswers: [], createdAt: "old", updatedAt: "old" } });
  const reviewed = session.saveAssessmentAnswers(definition, completeIphoneAnswers(), true);
  const progressed = { ...reviewed, session: { ...reviewed.session, status: "transaction_intent_selected", preliminaryValuation: { minPrice: 24500, maxPrice: 27000, currency: "THB" }, expectedPrice: { amount: 22000, currency: "THB", enteredBy: "seller", source: "manual_entry", createdAt: "now" }, transactionIntent: "outright_sale" } };
  global.window = memoryWindow(progressed);
  const same = session.saveAssessmentAnswers(definition, completeIphoneAnswers(), true);
  assert.equal(same.session.status, "transaction_intent_selected");
  assert.equal(same.session.expectedPrice.amount, 22000);
  const changed = completeIphoneAnswers({ device_powers_on: "yes" });
  const updated = session.saveAssessmentAnswers(definition, changed, true);
  assert.equal(updated.session.status, "condition_completed");
  assert.equal(updated.session.expectedPrice, undefined);
  assert.equal(updated.session.preliminaryValuation, undefined);
  assert.equal(updated.session.transactionIntent, undefined);
  assert.equal(updated.session.estimatedPrice, undefined);
});

test("mock valuation exposes the assessment, retains fixed range, and rejects assessment pricing", async () => {
  const service = new MockValuationService();
  assert.equal((await service.getDeviceAssessment(iphone)).id, "seller_reported_iphone_v1");
  assert.deepEqual(await service.getMockValuationResult({}), { minPrice: 24500, maxPrice: 27000, currency: "THB" });
  await assert.rejects(() => service.estimateValue({ assessment: {}, conditionAnswers: [] }), /not implemented/);
});

test("branch removal prunes repairs, power, battery, and feature answers without resurrecting them", () => {
  const repairYes = [
    choice("repair_or_parts_replaced", "yes"),
    answer("repaired_components", { kind: "multi", optionIds: ["display"] }),
    choice("display_replacement_provenance", "used"),
  ];
  const repairNo = assessment.pruneAnswers(definition, iphone, [choice("repair_or_parts_replaced", "no"), ...repairYes.slice(1)]);
  assert.deepEqual(repairNo.map((item) => item.questionId), ["repair_or_parts_replaced"]);
  assert.deepEqual(assessment.pruneAnswers(definition, iphone, [...repairNo, choice("repair_or_parts_replaced", "yes")]).map((item) => item.questionId), ["repair_or_parts_replaced"]);

  const poweredOff = assessment.pruneAnswers(definition, iphone, [choice("device_powers_on", "no"), choice("face_id_works", "yes")]);
  assert.deepEqual(poweredOff.map((item) => item.questionId), ["device_powers_on"]);
  assert.deepEqual(assessment.pruneAnswers(definition, iphone, [...poweredOff, choice("device_powers_on", "yes")]).map((item) => item.questionId), ["device_powers_on"]);

  const batteryNo = assessment.pruneAnswers(definition, iphone, [
    choice("battery_replaced", "no"),
    choice("repair_or_parts_replaced", "yes"),
    answer("repaired_components", { kind: "multi", optionIds: ["battery"] }),
    choice("battery_replacement_provenance", "used"),
  ]);
  assert.ok(!batteryNo.some((item) => item.questionId === "battery_replacement_provenance"));
  assert.ok(!assessment.pruneAnswers(definition, iphone, [...batteryNo, choice("battery_replaced", "yes")]).some((item) => item.questionId === "battery_replacement_provenance"));

  const featureAnswers = [choice("device_powers_on", "yes"), choice("face_id_works", "yes"), choice("wireless_charging_works", "yes")];
  const featureless = { ...definition, features: [] };
  const removedFeatures = assessment.pruneAnswers(featureless, iphone, featureAnswers);
  assert.deepEqual(removedFeatures.map((item) => item.questionId), ["device_powers_on"]);
  assert.deepEqual(assessment.pruneAnswers(definition, iphone, removedFeatures).map((item) => item.questionId), ["device_powers_on"]);
});

test("opening a required conditional branch prevents review completion until its answers are supplied", () => {
  const base = completeIphoneAnswers();
  const repairBranch = base.map((item) => item.questionId === "repair_or_parts_replaced" ? choice(item.questionId, "yes") : item);
  assert.equal(assessment.assessmentComplete(definition, iphone, repairBranch), false);
  const withComponents = [...repairBranch, answer("repaired_components", { kind: "multi", optionIds: ["display"] })];
  assert.equal(assessment.assessmentComplete(definition, iphone, withComponents), false);
  const complete = [...withComponents, choice("display_replacement_provenance", "unknown_unverified")];
  assert.equal(assessment.assessmentComplete(definition, iphone, complete), true);
});

test("incomplete or forged reviewed assessment cannot unlock later stages", () => {
  const incomplete = completeIphoneAnswers().filter((item) => item.questionId !== "find_my_enabled");
  const stored = {
    device: iphone,
    session: {
      id: "forged-incomplete", status: "handoff_ready", deviceId: iphone.id, conditionAnswers: [],
      assessment: { definitionId: definition.id, version: definition.version, source: "seller_reported", answers: incomplete, reviewedAt: "2026-09-22T00:00:00.000Z" },
      createdAt: "old", updatedAt: "old",
    },
  };
  global.window = memoryWindow(stored);
  assert.equal(session.hasCompletedAssessment(stored), false);
  assert.equal(session.updateExpectedPrice(22000), null);
  assert.equal(session.markLeadCollected("forged-incomplete"), null);
  assert.equal(session.markHandoffReady("forged-incomplete"), null);
});

test("legacy recovery preserves device and legacy evidence while resetting downstream state", () => {
  const stored = {
    device: iphone,
    session: {
      id: "legacy-recovery", status: "handoff_ready", deviceId: iphone.id,
      conditionAnswers: [{ questionId: "old", questionText: "old", answer: "good", normalizedScore: 1, weight: 1, answeredAt: "old" }],
      expectedPrice: { amount: 22000, currency: "THB", enteredBy: "seller", source: "manual_entry", createdAt: "old" }, estimatedPrice: { amount: 22000 },
      createdAt: "old", updatedAt: "old",
    },
  };
  global.window = memoryWindow(stored);
  const recovered = session.saveAssessmentAnswers(definition, [], false);
  assert.equal(recovered.session.id, "legacy-recovery");
  assert.equal(recovered.session.deviceId, iphone.id);
  assert.deepEqual(recovered.session.conditionAnswers, stored.session.conditionAnswers);
  assert.equal(recovered.session.status, "device_selected");
  assert.equal(recovered.session.expectedPrice, undefined);
  assert.equal(recovered.session.estimatedPrice, undefined);
});

test("semantic answer identity preserves downstream progress across ordering and timestamp changes", () => {
  global.window = memoryWindow({ device: iphone, session: { id: "independent-session", deviceId: iphone.id, status: "device_selected", conditionAnswers: [], createdAt: "old", updatedAt: "old" } });
  const original = completeIphoneAnswers({ repair_or_parts_replaced: "yes", repaired_components: ["camera", "display"] })
    .concat([choice("display_replacement_provenance", "used"), choice("camera_replacement_provenance", "third_party")]);
  assert.equal(assessment.assessmentComplete(definition, iphone, original), true);
  const reviewed = session.saveAssessmentAnswers(definition, original, true);
  const progressed = { ...reviewed, session: { ...reviewed.session, status: "transaction_intent_selected", preliminaryValuation: { minPrice: 24500, maxPrice: 27000, currency: "THB" }, expectedPrice: { amount: 22000, currency: "THB", enteredBy: "seller", source: "manual_entry", createdAt: "now" }, transactionIntent: "sell_and_repurchase" } };
  const reordered = [...original].reverse().map((item, index) => ({
    ...item,
    answeredAt: `2026-09-23T00:00:${String(index).padStart(2, "0")}.000Z`,
    value: item.value.kind === "multi"
      ? { optionIds: [...item.value.optionIds].reverse(), kind: "multi" }
      : { optionId: item.value.optionId, kind: "choice" },
  }));
  assert.equal(assessment.answerIdentity(original), assessment.answerIdentity(reordered));
  global.window = memoryWindow(progressed);
  const same = session.saveAssessmentAnswers(definition, reordered, true);
  assert.equal(same.session.status, "transaction_intent_selected");
  assert.equal(same.session.expectedPrice.amount, 22000);
  assert.equal(same.session.preliminaryValuation.minPrice, 24500);
  assert.equal(same.session.transactionIntent, "sell_and_repurchase");
});

test("basic fallback uses stable machine option IDs for Samsung and MacBook", () => {
  for (const device of [samsung, macbook]) {
    const basic = getMockAssessment(device);
    assert.equal(basic.id, "seller_reported_basic_v1");
    assert.deepEqual(basic.questions.map((question) => question.id), ["device_powers_on", "exterior_condition", "device_functions_normally"]);
    assert.deepEqual(basic.questions[0].options.map((option) => option.id), ["yes", "no", "unknown"]);
    assert.deepEqual(basic.questions[1].options.map((option) => option.id), ["none", "minor", "noticeable", "severe", "unknown"]);
    assert.deepEqual(basic.questions[2].options.map((option) => option.id), ["yes", "no", "unknown"]);
  }
});

test("numeric drafts accept boundaries and never turn malformed text into a saved value", () => {
  const question = definition.questions.find((item) => item.id === "battery_health_percentage");
  assert.deepEqual(assessment.parseNumericDraft(question, ""), { valid: true });
  for (const value of [0, 88, 100]) {
    assert.deepEqual(assessment.parseNumericDraft(question, String(value)), { valid: true, value: { kind: "number", value } });
  }
  for (const text of ["-1", "101", "80.5", "abc", "88%", " 88 ", "1e2", "88\n99"]) {
    assert.deepEqual(assessment.parseNumericDraft(question, text), { valid: false });
  }
  assert.equal(assessment.answerError(question, { kind: "unknown" }), null);
});

test("malformed current-version persisted assessments require recovery", () => {
  const base = { definitionId: definition.id, version: definition.version, source: "seller_reported" };
  for (const answers of [null, [null], [{ questionId: "device_powers_on", value: null }], [choice("device_powers_on", "yes"), choice("device_powers_on", "no")]]) {
    assert.equal(assessment.isCurrentAssessment({ ...base, answers }, definition), false);
  }
});
