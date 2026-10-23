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
const { mockDevices } = require("../adapters/mock/devices.ts");
const { deviceCatalog } = require("../data/devices/index.ts");
const { CONDITION_RULES, conditionDeductions, conditionScore } = require("../lib/condition-score.ts");
const session = require("../lib/valuation-session.ts");

test.after(() => {
  Module._resolveFilename = originalResolve;
  require.extensions[".ts"] = originalTsLoader;
});

const iphone = mockDevices.find((device) => device.id === "device-iphone-15-pro");
const samsung = mockDevices.find((device) => device.id === "device-samsung-s24-ultra");
const macbook = mockDevices.find((device) => device.id === "device-macbook-air-m3");
const ipad = deviceCatalog.find((device) => device.category === "tablet" && device.brand === "Apple");
const imac = deviceCatalog.find((device) => device.category === "desktop" && /^iMac/.test(device.model));
const mini = deviceCatalog.find((device) => /^Mac mini/.test(device.model));
const devices = [iphone, samsung, ipad, macbook, imac, mini];

const answer = (questionId, value) => ({ questionId, value, answeredAt: "2026-10-23T00:00:00.000Z" });
const choice = (optionId) => ({ kind: "choice", optionId });
const unknown = choice("unknown");

// Every visible question answered for a flawless device (battery 100%), then
// the overrides; repeats because answers reveal dependent questions.
function answersFor(device, overrides = {}) {
  const definition = getMockAssessment(device);
  const good = (question) => {
    if (typeof overrides === "function") {
      const value = overrides(question);
      if (value) return value;
    } else if (question.id in overrides) {
      return overrides[question.id];
    }
    if (question.type === "number") return { kind: "number", value: 100 };
    if (question.type === "single") return choice("none");
    if (question.type === "multi") return { kind: "multi", optionIds: ["other"] };
    const positive = /(_works?|powers_on|_ready|holds_charge|power_stability|_normal$)/.test(question.id);
    return choice(positive ? "yes" : "no");
  };
  let answers = [];
  for (let round = 0; round < 5; round += 1) {
    answers = assessment.applicableQuestions(definition, device, answers).map((question) => answer(question.id, good(question)));
  }
  return { definition, answers: assessment.pruneAnswers(definition, device, answers) };
}

const score = (device, overrides) => {
  const { definition, answers } = answersFor(device, overrides);
  return conditionScore(definition, device, answers).score;
};

test("every question the seller is asked has a weight, and every option a share", () => {
  for (const device of deviceCatalog) {
    const definition = getMockAssessment(device);
    for (const question of definition.questions) {
      // Ownership and account questions (hidden for now) say nothing about condition and are never scored.
      if (question.sectionId === "security" || question.sectionId === "organization") continue;
      const rule = CONDITION_RULES[question.id];
      assert.ok(rule, `${definition.id}: ${question.id} has no weight`);
      if (question.type === "number") continue;
      for (const option of question.options) {
        if (option.id === "unknown") continue;
        assert.ok(rule.options && option.id in rule.options, `${question.id}: option ${option.id} has no share`);
      }
    }
  }
});

test("reference scenarios score as designed", () => {
  const cases = [
    ["S1 flawless", iphone, {}, 100],
    ["S2 light scratches on screen and frame", iphone, { display_scratch_condition: choice("minor"), frame_body_condition: choice("minor") }, 95],
    ["S3 clear scratches and dents", iphone, { display_scratch_condition: choice("noticeable"), frame_body_condition: choice("noticeable") }, 84],
    ["S4 cracked screen glass", iphone, { display_glass_condition: choice("noticeable") }, 68],
    ["S5 display shows lines or dead pixels", iphone, { display_works: choice("no") }, 45],
    ["S6 Face ID broken", iphone, { face_id_works: choice("no") }, 75],
    ["S7 battery 78% with a service warning", iphone, { battery_health_percentage: { kind: "number", value: 78 }, battery_service_warning: choice("yes") }, 86],
    ["S8 third-party replacement screen", iphone, {
      repair_or_parts_replaced: choice("yes"), repaired_components: { kind: "multi", optionIds: ["display"] }, display_replacement_provenance: choice("third_party"),
    }, 78],
    ["S9 liquid damage", iphone, { severe_physical_or_liquid_damage: choice("yes") }, 50],
    ["S10 does not power on", iphone, { device_powers_on: choice("no") }, 15],
    ["S12 rear camera broken", iphone, { rear_camera_works: choice("no") }, 78],
    ["S13 MacBook keyboard broken and loose hinge", macbook, { keyboard_works: choice("no"), hinge_condition: choice("noticeable") }, 75],
    ["S14 cracked back glass", iphone, { back_glass_condition: choice("noticeable") }, 88],
    ["S15 Android cracked screen and worn battery", samsung, { display_glass_condition: choice("noticeable"), battery_degraded: choice("yes") }, 58],
    ["cracked screen with display lines", iphone, { display_glass_condition: choice("noticeable"), display_works: choice("no") }, 40],
    ["liquid damage and a cracked screen", iphone, { severe_physical_or_liquid_damage: choice("yes"), display_glass_condition: choice("noticeable") }, 34],
    ["genuine replacement screen", iphone, {
      repair_or_parts_replaced: choice("yes"), repaired_components: { kind: "multi", optionIds: ["display"] }, display_replacement_provenance: choice("genuine_or_original"),
    }, 95],
    ["screen glass unknown", iphone, { display_glass_condition: unknown }, 92],
    ["power unknown", iphone, { device_powers_on: unknown }, 80],
    ["MacBook does not charge", macbook, { charging_works: choice("no") }, 70],
    ["iMac does not stay on", imac, { power_stability: choice("no") }, 55],
    ["iMac display shows lines", imac, { built_in_display_works: choice("no") }, 45],
    ["Mac mini has no display output", mini, { external_display_output_works: choice("no") }, 70],
    ["iPad cracked screen", ipad, { display_glass_condition: choice("noticeable") }, 68],
    ["Android cracked screen", samsung, { display_glass_condition: choice("noticeable") }, 68],
  ];
  for (const [name, device, overrides, expected] of cases) assert.equal(score(device, overrides), expected, name);
});

test("a seller who knows nothing gets 80, never a guess either way", () => {
  for (const device of devices) {
    const allUnknown = (question) => (question.type === "number" ? { kind: "unknown" } : question.type === "multi" ? undefined : unknown);
    assert.equal(score(device, allUnknown), 80, device.id);
    assert.equal(score(device), 100, `${device.id} flawless`);
  }
});

test("a worse answer never raises the score, and faults compound", () => {
  for (const device of devices) {
    const { definition, answers } = answersFor(device);
    const healthy = conditionScore(definition, device, answers).score;
    for (const question of assessment.applicableQuestions(definition, device, answers)) {
      if (question.type !== "single" && question.type !== "yes_no_unknown") continue;
      for (const option of question.options) {
        const single = score(device, { [question.id]: choice(option.id) });
        assert.ok(single <= healthy, `${device.id} ${question.id}=${option.id}`);
        if (question.id === "display_glass_condition" || question.id === "device_powers_on") continue;
        const withCrack = score(device, { [question.id]: choice(option.id), display_glass_condition: choice("noticeable") });
        assert.ok(withCrack <= single, `${device.id} ${question.id}=${option.id} plus a crack`);
        assert.ok(withCrack >= 0);
      }
    }
  }
});

test("battery health bands and the dead-device cap", () => {
  const battery = (value) => score(iphone, { battery_health_percentage: { kind: "number", value } });
  assert.deepEqual([100, 95, 92, 87, 82, 75, 60].map(battery), [100, 100, 99, 97, 94, 87, 84]);
  // A device that does not power on cannot report its battery, whatever was answered.
  assert.equal(score(iphone, { device_powers_on: choice("no"), battery_health_percentage: { kind: "number", value: 60 } }), 15);
  assert.equal(score(iphone, { device_powers_on: choice("no"), severe_physical_or_liquid_damage: choice("yes") }), 8, "15 is a ceiling, not a floor");
});

test("answers to removed or hidden questions, and their order, do not change the score", () => {
  const { definition, answers } = answersFor(iphone);
  const base = conditionScore(definition, iphone, answers).score;
  const stale = [...answers, answer("bluetooth_works", choice("no")), answer("included_accessories", { kind: "multi", optionIds: ["none"] }), answer("find_my_enabled", choice("yes"))];
  assert.equal(conditionScore(definition, iphone, stale).score, base);
  assert.equal(conditionScore(definition, iphone, [...answers].reverse()).score, base);
  const hiddenRepair = [...answers, answer("display_replacement_provenance", choice("third_party"))];
  assert.equal(conditionScore(definition, iphone, hiddenRepair).score, base, "a provenance answer counts only while its repair is reported");
});

test("the score is stored with its model and per-group points, and prices the result", () => {
  const { definition, answers } = answersFor(iphone, { display_glass_condition: choice("noticeable"), battery_health_percentage: { kind: "number", value: 92 } });
  const result = conditionScore(definition, iphone, answers);
  assert.equal(result.score, 67);
  assert.deepEqual(conditionDeductions(result), [
    { model: "atlas_condition_v1", group: "display", points: 32 },
    { model: "atlas_condition_v1", group: "battery", points: 0.8 },
  ]);
  const stored = { device: iphone, session: { id: "s", status: "preliminary_valuation_available", assessment: { definitionId: definition.id, version: definition.version, source: "seller_reported", answers } } };
  assert.equal(session.shownUsedPrice(stored, { marketPrice: 40000 }), 26800, "40,000 × 0.67");
  assert.equal(session.shownUsedPrice({ ...stored, session: { ...stored.session, assessment: undefined } }, { marketPrice: 40000 }), 0);
});
