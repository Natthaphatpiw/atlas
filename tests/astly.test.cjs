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
const { toAstlyConditionChecks, toAstlyEstimateInput, UnsupportedDeviceError } = require("../lib/astly-estimate-input.ts");
const { parseEstimateRequest } = require("../lib/estimate-request.ts");
const { estimateRequestBody } = require("../lib/estimate-request-body.ts");
const { AstlyApiError, createAstlyEstimate, getAstlyEstimate } = require("../lib/server/astly-client.ts");
const { clientNetwork, issueEstimateTicket, readEstimateTicket, visitorId } = require("../lib/server/visitor.ts");
const session = require("../lib/valuation-session.ts");
const { formatValuation } = require("../lib/valuation-format.ts");

const originalFetch = global.fetch;
const originalEnv = { ...process.env };
test.after(() => {
  Module._resolveFilename = originalResolve;
  require.extensions[".ts"] = originalTsLoader;
  global.fetch = originalFetch;
  process.env = originalEnv;
  delete global.window;
});

const iphone = mockDevices.find((device) => device.id === "device-iphone-15-pro");
const samsung = mockDevices.find((device) => device.id === "device-samsung-s24-ultra");
const macbook = mockDevices.find((device) => device.id === "device-macbook-air-m3");
const answer = (questionId, value) => ({ questionId, value, answeredAt: "2026-09-28T00:00:00.000Z" });

// Answers every visible question as a healthy, sellable device, then applies
// overrides; repeats because answers reveal dependent questions.
function healthyAnswers(device, overrides = {}) {
  const definition = getMockAssessment(device);
  const good = (question) => {
    if (question.id in overrides) return overrides[question.id];
    if (question.type === "number") return { kind: "number", value: 92 };
    if (question.type === "single") return { kind: "choice", optionId: "none" };
    if (question.type === "multi") return { kind: "multi", optionIds: ["other"] };
    const positive = /(_works?|powers_on|usable_normally|functions_normally|_ready|can_sign_out|has_no_defects|holds_charge|power_stability|_normal$)/.test(question.id);
    return { kind: "choice", optionId: positive ? "yes" : "no" };
  };
  let answers = [];
  for (let round = 0; round < 5; round += 1) {
    answers = assessment.applicableQuestions(definition, device, answers).map((question) => answer(question.id, good(question)));
  }
  return { definition, answers: assessment.pruneAnswers(definition, device, answers) };
}

const noFaults = {
  screenCrack: false, screenLineDeadPixel: false, touchIssue: false, batteryIssue: false,
  bodyDamage: false, cameraIssue: false, portButtonIssue: false, waterIssue: false,
};
const choiceValue = (optionId) => ({ kind: "choice", optionId });

test("a healthy iPhone and a healthy Android report no checklist faults", () => {
  for (const device of [iphone, samsung]) {
    const { definition, answers } = healthyAnswers(device);
    assert.equal(assessment.assessmentComplete(definition, device, answers), true, device.id);
    assert.deepEqual(toAstlyConditionChecks(definition, device, answers), noFaults, device.id);
  }
});

test("iPhone answers map onto Astly's checklist items", () => {
  const { definition, answers } = healthyAnswers(iphone, {
    display_glass_condition: choiceValue("minor"),
    frame_body_condition: choiceValue("minor"),
    battery_health_percentage: { kind: "number", value: 79 },
    face_id_works: choiceValue("no"),
    speakers_work: choiceValue("no"),
  });
  assert.deepEqual(toAstlyConditionChecks(definition, iphone, answers), {
    ...noFaults, screenCrack: true, batteryIssue: true, cameraIssue: true, portButtonIssue: true,
  });
});

test("unknown never deducts, and a device that does not power on is priced as such", () => {
  const unknown = choiceValue("unknown");
  const { definition, answers } = healthyAnswers(iphone, {
    display_glass_condition: unknown, back_glass_condition: unknown, display_works: unknown,
    battery_health_percentage: { kind: "unknown" }, battery_service_warning: unknown,
  });
  assert.deepEqual(toAstlyConditionChecks(definition, iphone, answers), noFaults);

  const dead = healthyAnswers(iphone, { device_powers_on: choiceValue("no") });
  assert.ok(!dead.answers.some((item) => item.questionId === "display_works"), "function answers are hidden");
  assert.deepEqual(toAstlyConditionChecks(dead.definition, iphone, dead.answers), { ...noFaults, waterIssue: true });
});

test("Android answers from the basic assessment cover every checklist item", () => {
  const { definition, answers } = healthyAnswers(samsung, {
    severe_physical_or_liquid_damage: choiceValue("yes"),
    display_glass_condition: choiceValue("severe"),
    exterior_condition: choiceValue("noticeable"),
    display_works: choiceValue("no"),
    touchscreen_works: choiceValue("no"),
    cameras_work: choiceValue("no"),
    buttons_ports_work: choiceValue("no"),
    battery_degraded: choiceValue("yes"),
  });
  const checks = toAstlyConditionChecks(definition, samsung, answers);
  assert.ok(Object.values(checks).every(Boolean), JSON.stringify(checks));
});

test("a minor dent or crack reported on the basic assessment counts as body damage", () => {
  const { definition, answers } = healthyAnswers(samsung, { exterior_condition: choiceValue("minor") });
  assert.equal(toAstlyConditionChecks(definition, samsung, answers).bodyDamage, true);
  const iphoneMinor = healthyAnswers(iphone, { frame_body_condition: choiceValue("minor"), back_glass_condition: choiceValue("minor") });
  assert.equal(toAstlyConditionChecks(iphoneMinor.definition, iphone, iphoneMinor.answers).bodyDamage, false, "iPhone questions include cosmetic scratches");
});

test("devices become the same Astly request the LINE estimate form sends", () => {
  assert.deepEqual(toAstlyEstimateInput({ ...iphone, specs: { ...iphone.specs, storage: "512GB" } }, noFaults), {
    itemType: "Apple", appleCategory: "iPhone", brand: "Apple", model: "iPhone 15 Pro", capacity: "512GB", conditionChecks: noFaults,
  });
  const android = toAstlyEstimateInput({ ...samsung, specs: { ...samsung.specs, storage: "256GB" } }, noFaults);
  assert.equal(android.itemType, "โทรศัพท์มือถือ");
  assert.equal(android.model, "Galaxy S24 Ultra", "the catalog's storage-only variant must not contradict the chosen capacity");
  assert.equal(android.capacity, "256GB");
  assert.equal(android.appleCategory, undefined);
  assert.equal(android.brand, "Samsung");
  assert.ok(!("color" in android), "colour would only split Astly's cache");
  const macbookInput = toAstlyEstimateInput(macbook, noFaults);
  assert.equal(macbookInput.appleCategory, "MacBook");
  assert.equal(macbookInput.model, "MacBook Air (M3, 13-inch)");
  assert.match(macbookInput.appleSpecs, /^M3 .*RAM 16GB · SSD 512GB · 13\.6-inch$/);
  assert.throws(() => toAstlyEstimateInput({ ...samsung, category: "watch" }, noFaults), UnsupportedDeviceError);
});

test("every catalog device maps to an Astly request in a category Astly's demo API accepts", () => {
  const astlyAppleCategories = ["iPhone", "iPad", "MacBook", "iMac", "Mac mini", "Mac Studio", "Mac Pro"];
  const seen = new Set();
  for (const device of deviceCatalog) {
    const input = toAstlyEstimateInput(device, noFaults);
    assert.ok(input.model && input.brand, device.id);
    if (input.itemType === "Apple") {
      assert.ok(astlyAppleCategories.includes(input.appleCategory), `${device.id}: ${input.appleCategory}`);
      seen.add(input.appleCategory);
    } else {
      assert.equal(input.appleCategory, undefined, device.id);
      seen.add(input.itemType);
    }
    for (const value of Object.values(input)) if (typeof value === "string") assert.ok(value.length <= 200, device.id);
  }
  for (const expected of ["iPhone", "iPad", "MacBook", "iMac", "Mac mini", "Mac Studio", "Mac Pro", "โทรศัพท์มือถือ", "แท็บเล็ต"]) assert.ok(seen.has(expected), expected);
});

test("tablet, MacBook and Mac desktop answers map onto Astly's checklist", () => {
  const tablet = deviceCatalog.find((device) => device.category === "tablet" && device.brand !== "Apple");
  const healthyTablet = healthyAnswers(tablet);
  assert.equal(healthyTablet.definition.coverage, "tablet");
  assert.deepEqual(toAstlyConditionChecks(healthyTablet.definition, tablet, healthyTablet.answers), noFaults);
  const brokenTablet = healthyAnswers(tablet, {
    frame_body_condition: choiceValue("minor"),
    display_has_no_defects: choiceValue("no"),
    battery_holds_charge: choiceValue("no"),
    charging_port_works: choiceValue("no"),
  });
  assert.deepEqual(toAstlyConditionChecks(brokenTablet.definition, tablet, brokenTablet.answers), {
    ...noFaults, bodyDamage: true, screenLineDeadPixel: true, batteryIssue: true, portButtonIssue: true,
  }, "the tablet frame question asks about damage only, so minor counts");

  const healthyMac = healthyAnswers(macbook);
  assert.equal(healthyMac.definition.coverage, "macbook");
  assert.deepEqual(toAstlyConditionChecks(healthyMac.definition, macbook, healthyMac.answers), noFaults);
  const wornMac = healthyAnswers(macbook, { case_body_condition: choiceValue("minor"), hinge_condition: choiceValue("minor") });
  assert.equal(toAstlyConditionChecks(wornMac.definition, macbook, wornMac.answers).bodyDamage, false, "light wear is not damage");
  const brokenMac = healthyAnswers(macbook, { chassis_bending_condition: choiceValue("minor"), keyboard_works: choiceValue("no"), camera_works: choiceValue("no") });
  assert.deepEqual(toAstlyConditionChecks(brokenMac.definition, macbook, brokenMac.answers), {
    ...noFaults, bodyDamage: true, portButtonIssue: true, cameraIssue: true,
  });

  const imac = deviceCatalog.find((device) => device.category === "desktop" && /^iMac/.test(device.model));
  const brokenImac = healthyAnswers(imac, { built_in_display_has_no_defects: choiceValue("no"), power_stability: choiceValue("no") });
  assert.equal(brokenImac.definition.coverage, "desktop");
  assert.deepEqual(toAstlyConditionChecks(brokenImac.definition, imac, brokenImac.answers), {
    ...noFaults, screenLineDeadPixel: true, waterIssue: true,
  });
  const mini = deviceCatalog.find((device) => /^Mac mini/.test(device.model));
  const miniInput = toAstlyEstimateInput(mini, noFaults);
  assert.equal(miniInput.appleCategory, "Mac mini");
});

test("the server prices only catalog devices with a complete, current assessment", () => {
  const { answers, definition } = healthyAnswers(iphone, { display_glass_condition: choiceValue("severe") });
  const seller = { definitionId: definition.id, version: definition.version, source: "seller_reported", answers };
  const body = estimateRequestBody(iphone, seller);
  const input = parseEstimateRequest(JSON.parse(JSON.stringify(body)));
  assert.equal(input.model, "iPhone 15 Pro");
  assert.equal(input.capacity, "256GB");
  assert.equal(input.conditionChecks.screenCrack, true);

  const rejected = (mutate) => parseEstimateRequest(mutate(JSON.parse(JSON.stringify(body))));
  assert.equal(rejected((raw) => ({ ...raw, deviceId: "device-unknown" })), null);
  assert.equal(rejected((raw) => ({ ...raw, specs: { ...raw.specs, storage: "9TB" } })), null);
  assert.equal(rejected((raw) => ({ ...raw, specs: { ...raw.specs, network: "6G" } })), null);
  assert.equal(rejected((raw) => ({ ...raw, assessment: { ...raw.assessment, version: 99 } })), null);
  assert.equal(rejected((raw) => ({ ...raw, assessment: { ...raw.assessment, answers: raw.assessment.answers.slice(1) } })), null);
  assert.equal(rejected((raw) => ({ ...raw, assessment: { ...raw.assessment, answers: "all good" } })), null);
  assert.equal(rejected(() => null), null);
});

function stubFetch(status, json, headers = {}) {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(json === undefined ? "" : JSON.stringify(json), { status, headers: { "content-type": "application/json", ...headers } });
  };
  return calls;
}

const input = toAstlyEstimateInput(iphone, noFaults);
const condition = { score: 100, deductions: [] };

test("creating an estimate authenticates to Astly server-side and validates the reply", async () => {
  process.env.ASTLY_DEMO_API_KEY = "k".repeat(40);
  process.env.ASTLY_API_BASE_URL = "https://astly.test/";
  const calls = stubFetch(202, { jobId: "0f8fad5b-d9cb-469f-a165-70867728950e", status: "QUEUED", pollAfterMs: 500, condition });
  const accepted = await createAstlyEstimate(input, "visitor_0123456789abcdef");
  assert.deepEqual(accepted, { jobId: "0f8fad5b-d9cb-469f-a165-70867728950e", status: "QUEUED", pollAfterMs: 2000, condition });
  assert.equal(calls[0].url, "https://astly.test/api/demo/estimate");
  assert.equal(calls[0].init.headers.authorization, `Bearer ${"k".repeat(40)}`);
  assert.equal(calls[0].init.headers["x-demo-visitor"], "visitor_0123456789abcdef");
  assert.deepEqual(JSON.parse(calls[0].init.body), input);
});

test("Astly failures become safe Atlas errors", async () => {
  process.env.ASTLY_DEMO_API_KEY = "k".repeat(40);
  const expectError = async (promise, status, code) => {
    await assert.rejects(promise, (error) => error instanceof AstlyApiError && error.status === status && error.body.code === code);
  };
  stubFetch(429, { code: "job_rate_limited", retryAfterSeconds: 420 });
  await assert.rejects(createAstlyEstimate(input, "visitor_0123456789abcdef"), (error) => error.status === 429 && error.body.retryAfterSeconds === 420);
  stubFetch(401, { error: "Unauthorized" });
  await expectError(createAstlyEstimate(input, "v".repeat(20)), 503, "estimate_unconfigured");
  stubFetch(404, { error: "Not found" });
  await expectError(createAstlyEstimate(input, "v".repeat(20)), 503, "estimate_unconfigured");
  stubFetch(400, { code: "invalid_ai_job_input" });
  await expectError(createAstlyEstimate(input, "v".repeat(20)), 422, "unsupported_device");
  stubFetch(202, { jobId: "not a job", status: "QUEUED", condition });
  await expectError(createAstlyEstimate(input, "v".repeat(20)), 503, "estimate_unavailable");
  global.fetch = async () => { throw new TypeError("fetch failed"); };
  await expectError(createAstlyEstimate(input, "v".repeat(20)), 503, "estimate_unavailable");
  delete process.env.ASTLY_DEMO_API_KEY;
  await expectError(createAstlyEstimate(input, "v".repeat(20)), 503, "estimate_unconfigured");
});

test("polling returns validated results and failures", async () => {
  process.env.ASTLY_DEMO_API_KEY = "k".repeat(40);
  const jobId = "0f8fad5b-d9cb-469f-a165-70867728950e";
  const result = {
    estimatedPrice: 14500, marketPrice: 25000, pawnPrice: 15000, condition: 0.97, confidence: 0.85, loanToValue: 0.6,
    productName: "Apple iPhone 15 Pro 256GB", calculation: { marketPrice: "a", pawnPrice: "b", finalPrice: "c" },
    completedAt: "2026-09-28T00:00:00.000Z", estimateAttestation: "must-not-pass-through",
  };
  stubFetch(200, { jobId, status: "COMPLETED", pollAfterMs: 3000, result });
  const done = await getAstlyEstimate(jobId, "v".repeat(20));
  assert.equal(done.result.estimatedPrice, 14500);
  assert.ok(!("estimateAttestation" in done.result));
  stubFetch(200, { jobId, status: "COMPLETED", pollAfterMs: 3000, result: { ...result, marketPrice: "25000" } });
  await assert.rejects(getAstlyEstimate(jobId, "v".repeat(20)), (error) => error.status === 503);
  stubFetch(200, { jobId, status: "FAILED", error: "ระบบทดลองยังประเมินราคาสินค้ารุ่นนี้ไม่ได้", code: "demo_estimate_unavailable" });
  const failed = await getAstlyEstimate(jobId, "v".repeat(20));
  assert.equal(failed.code, "demo_estimate_unavailable");
  stubFetch(404, { code: "job_not_found" });
  await assert.rejects(getAstlyEstimate(jobId, "v".repeat(20)), (error) => error.status === 404 && error.body.code === "job_not_found");
});

test("visitor ids need an Atlas-only secret, are opaque, and group an IPv6 host's /64", () => {
  process.env.ASTLY_DEMO_API_KEY = "k".repeat(40);
  delete process.env.ATLAS_VISITOR_SECRET;
  assert.throws(() => visitorId(new Headers({ "x-forwarded-for": "203.0.113.7" })), (error) => error.status === 503 && error.body.code === "estimate_unconfigured");
  process.env.ATLAS_VISITOR_SECRET = "k".repeat(40);
  assert.throws(() => visitorId(new Headers({ "x-forwarded-for": "203.0.113.7" })), (error) => error.status === 503, "must differ from the Astly key");
  process.env.ATLAS_VISITOR_SECRET = "s".repeat(40);

  const a = visitorId(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }));
  assert.match(a, /^[A-Za-z0-9_-]{32}$/);
  assert.ok(!a.includes("203"));
  assert.equal(visitorId(new Headers({ "x-forwarded-for": "203.0.113.7" })), a);
  assert.equal(visitorId(new Headers({ "x-forwarded-for": "::ffff:203.0.113.7" })), a);
  assert.notEqual(visitorId(new Headers({ "x-forwarded-for": "203.0.113.8" })), a);

  assert.equal(clientNetwork(new Headers({ "x-forwarded-for": "2001:db8:1:2::1" })), "2001:0db8:0001:0002::/64");
  const v6 = visitorId(new Headers({ "x-forwarded-for": "2001:db8:1:2::1" }));
  assert.equal(visitorId(new Headers({ "x-forwarded-for": "2001:db8:1:2:ffff:eeee:dddd:cccc" })), v6, "rotating within a /64 is one visitor");
  assert.notEqual(visitorId(new Headers({ "x-forwarded-for": "2001:db8:1:3::1" })), v6);
});

test("estimate tickets let the starting visitor keep polling from any network, and nobody else", () => {
  process.env.ASTLY_DEMO_API_KEY = "k".repeat(40);
  process.env.ATLAS_VISITOR_SECRET = "s".repeat(40);
  const jobId = "0f8fad5b-d9cb-469f-a165-70867728950e";
  const now = Date.UTC(2026, 8, 28, 10);
  const ticket = issueEstimateTicket(jobId, "visitor_on_wifi_0000000000000000", now);
  assert.equal(readEstimateTicket(ticket, jobId, now + 60_000), "visitor_on_wifi_0000000000000000");
  assert.equal(readEstimateTicket(ticket, "1f8fad5b-d9cb-469f-a165-70867728950e", now), null, "bound to its job");
  assert.equal(readEstimateTicket(ticket, jobId, now + 4 * 60 * 60 * 1000), null, "expires");
  const [payload, signature] = ticket.split(".");
  const forged = Buffer.from(JSON.stringify({ j: jobId, v: "someone_else_000000000000000000", t: now })).toString("base64url");
  assert.equal(readEstimateTicket(`${forged}.${signature}`, jobId, now), null, "payload is signed");
  assert.equal(readEstimateTicket(`${payload}.${signature}x`, jobId, now), null);
  assert.equal(readEstimateTicket(null, jobId, now), null);
  process.env.ATLAS_VISITOR_SECRET = "t".repeat(40);
  assert.equal(readEstimateTicket(ticket, jobId, now), null, "rotating the secret revokes tickets");
  process.env.ATLAS_VISITOR_SECRET = "s".repeat(40);
});

function memoryWindow(initial) {
  const entries = new Map(initial ? [["atlast.valuation.session", JSON.stringify(initial)]] : []);
  return { sessionStorage: { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: (key) => entries.delete(key) } };
}

test("an estimate job resumes only for what Astly prices, and its result is stored as a point valuation", () => {
  const { definition, answers } = healthyAnswers(iphone);
  const stored = session.createDeviceSession(iphone);
  stored.session.status = "condition_completed";
  stored.session.assessment = { definitionId: definition.id, version: definition.version, source: "seller_reported", answers, reviewedAt: "2026-09-28T00:00:00.000Z" };
  global.window = memoryWindow(stored);

  const key = session.estimateRequestKey(stored);
  assert.deepEqual(JSON.parse(key), toAstlyEstimateInput(iphone, noFaults), "the key is the request Astly receives");
  const accepted = { jobId: "0f8fad5b-d9cb-469f-a165-70867728950e", status: "QUEUED", pollAfterMs: 4000, condition, ticket: "t.s" };
  assert.equal(session.saveEstimateJob(accepted, "some other configuration"), null, "a job is saved only for what it priced");
  const withJob = session.saveEstimateJob(accepted, key);
  assert.equal(session.currentEstimateJob(withJob).ticket, "t.s");
  assert.equal(session.currentEstimateJob(withJob, Date.now() + 2 * 60 * 60 * 1000), null, "expired jobs are not resumed");

  const unpriced = session.saveAssessmentAnswers(definition, answers.map((item) =>
    item.questionId === "find_my_enabled" ? { ...item, value: choiceValue("yes") } : item), true);
  assert.ok(session.currentEstimateJob(unpriced), "an answer Astly never sees keeps the job");

  const edited = session.saveAssessmentAnswers(definition, answers.map((item) =>
    item.questionId === "display_glass_condition" ? { ...item, value: choiceValue("severe") } : item), true);
  assert.equal(edited.session.estimateJob, undefined, "a priced change drops the pending job");

  const requestKey = session.estimateRequestKey(edited);
  const result = { estimatedPrice: 12000, marketPrice: 25000, pawnPrice: 15000, condition: 0.68, confidence: 0.85, loanToValue: 0.6, productName: "", calculation: { marketPrice: "", pawnPrice: "", finalPrice: "" }, completedAt: "2026-09-28T00:00:00.000Z" };
  const saved = session.markPreliminaryValuationAvailable({ minPrice: 12000, maxPrice: 12000, currency: "THB", source: "astly", astly: { jobId: "0f8fad5b-d9cb-469f-a165-70867728950e", requestKey, condition, result } });
  assert.equal(session.currentAstlyValuation(saved).result.estimatedPrice, 12000);
  assert.equal(formatValuation(saved.session.preliminaryValuation), "฿12,000");
  assert.equal(formatValuation({ minPrice: 24500, maxPrice: 27000 }), "฿24,500 – ฿27,000");

  const scratched = session.saveAssessmentAnswers(definition, edited.session.assessment.answers.map((item) =>
    item.questionId === "display_scratch_condition" ? { ...item, value: choiceValue("noticeable") } : item), true);
  assert.equal(session.currentAstlyValuation(scratched)?.result.estimatedPrice, 12000, "an unpriced edit keeps the valuation");
  assert.equal(session.hasPreliminaryValuation(scratched), false, "…but the step must be confirmed again on Result");

  const reverted = session.saveAssessmentAnswers(definition, answers, true);
  assert.equal(session.currentAstlyValuation(reverted), null, "a priced change invalidates the valuation");
  assert.equal(reverted.session.preliminaryValuation, undefined);
});
