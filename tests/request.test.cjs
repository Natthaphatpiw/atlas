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

const { getMockAssessment } = require("../adapters/mock/assessment.ts");
const { mockDevices } = require("../adapters/mock/devices.ts");
const { MockRequestService } = require("../adapters/mock/request.ts");
const assessment = require("../lib/assessment.ts");
const sellerContact = require("../lib/seller-contact.ts");
const session = require("../lib/valuation-session.ts");

test.after(() => {
  Module._resolveFilename = originalResolve;
  require.extensions[".ts"] = originalTsLoader;
});

const iphone = mockDevices.find((device) => device.id === "device-iphone-15-pro");
const definition = getMockAssessment(iphone);
const answer = (questionId, value) => ({ questionId, value, answeredAt: "2026-09-23T00:00:00.000Z" });
const choice = (questionId, optionId) => answer(questionId, { kind: "choice", optionId });

function completeAnswers() {
  return definition.questions
    .filter((question) => question.required)
    .filter((question) => question.id !== "repaired_components")
    .filter((question) => !["display_replacement_provenance", "battery_replacement_provenance", "camera_replacement_provenance"].includes(question.id))
    .map((question) => question.type === "multi"
      ? answer(question.id, { kind: "multi", optionIds: ["display"] })
      : choice(question.id, question.type === "single" ? "none" : "no"));
}

function memoryWindow(initial) {
  const entries = new Map(initial ? [["atlast.valuation.session", JSON.stringify(initial)]] : []);
  return {
    sessionStorage: {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
      removeItem: (key) => entries.delete(key),
    },
    entries,
  };
}

function storedReadySession(id = "request-session") {
  const answers = completeAnswers();
  assert.equal(assessment.assessmentComplete(definition, iphone, answers), true);
  return {
    device: iphone,
    session: {
      id,
      deviceId: iphone.id,
      status: "estimated",
      conditionAnswers: [],
      assessment: {
        definitionId: definition.id,
        version: definition.version,
        source: "seller_reported",
        answers,
        reviewedAt: "2026-09-23T00:00:00.000Z",
      },
      expectedPrice: { amount: 22000, currency: "THB", enteredBy: "seller", source: "manual_entry", createdAt: "2026-09-23T00:00:00.000Z" },
      estimatedPrice: { amount: 22000 },
      createdAt: "2026-09-23T00:00:00.000Z",
      updatedAt: "2026-09-23T00:00:00.000Z",
    },
  };
}

function requestContext(stored) {
  return {
    device: stored.device,
    assessment: stored.session.assessment,
    expectedPrice: stored.session.expectedPrice,
    preliminaryValuation: { minPrice: 24500, maxPrice: 27000, currency: "THB" },
  };
}

async function receiptFor(stored) {
  return new MockRequestService().submitRequest({
    sessionId: stored.session.id,
    context: requestContext(stored),
    contact: { fullName: "Ada Seller", phone: "0812345678", lineIdProvided: "ada-line", consentToContact: true },
    source: "atlast_web",
  });
}

test("seller contact trims optional LINE text without validating its contents", () => {
  const blank = sellerContact.normalizeSellerContact({ fullName: "  Ada  ", phone: " 081-234 5678 ", lineIdProvided: "  \t ", consentToContact: true });
  assert.deepEqual(blank, { fullName: "Ada", phone: "0812345678", consentToContact: true });
  const arbitrary = sellerContact.normalizeSellerContact({ fullName: "Ada", phone: "0812345678", lineIdProvided: "  @ada / anything?  ", consentToContact: true });
  assert.equal(arbitrary.lineIdProvided, "@ada / anything?");
  assert.deepEqual(sellerContact.contactErrors(arbitrary), { name: "", phone: "", consent: "" });
});

test("seller contact requires name, phone, and consent", () => {
  const errors = sellerContact.contactErrors({ fullName: "   ", phone: "", consentToContact: false });
  assert.ok(errors.name);
  assert.ok(errors.phone);
  assert.ok(errors.consent);
  assert.equal(sellerContact.contactErrors({ fullName: "Ada", phone: "081-234 5678", consentToContact: true }).phone, "");
});

test("mock receipt is a non-PII browser-local prototype receipt", async () => {
  const stored = storedReadySession();
  const receipt = await receiptFor(stored);
  const serialized = JSON.stringify(receipt);
  assert.match(receipt.id, /^mock-request-/);
  assert.match(receipt.reference, /^MOCK-[A-F0-9]{8}$/);
  assert.equal(receipt.lineConnection, "prototype_pending");
  assert.equal(receipt.sessionId, stored.session.id);
  assert.ok(!serialized.includes("Ada Seller"));
  assert.ok(!serialized.includes("0812345678"));
  assert.ok(!serialized.includes("ada-line"));
  assert.equal("contact" in receipt, false);
  assert.equal("source" in receipt, false);
  assert.equal("devicePhotos" in receipt, false);
  assert.doesNotMatch(serialized, /devicePhotos|previewUrl|object:|blob:/i);
});

test("only a matching receipt with a complete current context advances the session", async () => {
  const stored = storedReadySession();
  global.window = memoryWindow(stored);
  const receipt = await receiptFor(stored);
  assert.equal(session.hasRequestPrerequisites(stored), true);
  const submitted = session.markRequestSubmitted(receipt);
  assert.equal(submitted.session.status, "request_submitted");
  assert.equal(session.hasSubmittedRequest(submitted), true);
  assert.equal(session.markRequestSubmitted(receipt).session.request.reference, submitted.session.request.reference);

  const legacy = storedReadySession("legacy-status");
  legacy.session.status = "handoff_ready";
  global.window = memoryWindow(legacy);
  assert.equal(session.hasSubmittedRequest(legacy), false);
  assert.equal(session.readValuationSession().session.request, undefined);
});

test("a changed context while the mock service awaits is refused", async () => {
  const stored = storedReadySession();
  global.window = memoryWindow(stored);
  const receipt = await receiptFor(stored);
  const changed = { ...stored, session: { ...stored.session, expectedPrice: { ...stored.session.expectedPrice, amount: 21000 } } };
  global.window = memoryWindow(changed);
  assert.equal(session.markRequestSubmitted(receipt), null);
  assert.equal(session.readValuationSession().session.request, undefined);
});

test("a submitted request prevents all assessment, price, device, and raw-session mutations", async () => {
  const stored = storedReadySession();
  global.window = memoryWindow(stored);
  const submitted = session.markRequestSubmitted(await receiptFor(stored));
  const before = global.window.sessionStorage.getItem("atlast.valuation.session");
  assert.equal(session.saveAssessmentAnswers(definition, completeAnswers(), true), null);
  assert.equal(session.updateExpectedPrice(21000), null);
  assert.equal(session.continueWithDevice({ ...iphone, specs: { ...iphone.specs, storage: "128GB" } }).session.request.reference,
    submitted.session.request.reference);
  assert.throws(() => session.saveValuationSession(stored), /Submitted request cannot be edited/);
  assert.equal(global.window.sessionStorage.getItem("atlast.valuation.session"), before);
});

test("a persisted receipt remains valid after session-storage parsing on refresh", async () => {
  const stored = storedReadySession("refresh-session");
  global.window = memoryWindow(stored);
  const submitted = session.markRequestSubmitted(await receiptFor(stored));
  const raw = global.window.sessionStorage.getItem("atlast.valuation.session");
  global.window = memoryWindow(JSON.parse(raw));
  const refreshed = session.readValuationSession();
  assert.equal(session.hasSubmittedRequest(refreshed), true);
  assert.equal(refreshed.session.request.reference, submitted.session.request.reference);
  assert.equal(refreshed.session.request.context.expectedPrice.amount, 22000);
});

test("status alone, incomplete context, and mismatched receipts cannot submit", async () => {
  for (const status of ["lead_collected", "handoff_ready", "request_submitted"]) {
    const stored = storedReadySession();
    stored.session.status = status;
    assert.equal(session.hasSubmittedRequest(stored), false);
  }
  const stored = storedReadySession();
  const receipt = await receiptFor(stored);
  for (const change of [
    (s) => { s.session.assessment.answers = []; },
    (s) => { delete s.session.assessment.reviewedAt; },
    (s) => { s.session.expectedPrice.amount = 0; },
    (s) => { s.session.expectedPrice.amount = 1.5; },
    (s) => { s.session.deviceId = "other"; },
  ]) {
    const invalid = structuredClone(stored); change(invalid);
    global.window = memoryWindow(invalid);
    assert.equal(session.markRequestSubmitted(receipt), null);
  }
  global.window = memoryWindow(stored);
  assert.equal(session.markRequestSubmitted({ ...receipt, sessionId: "other" }), null);
  assert.equal(session.markRequestSubmitted({ ...receipt, context: { ...receipt.context, assessment: { ...receipt.context.assessment, answers: [null] } } }), null);
});

test("mock service rejects missing consent and invalid required contact", async () => {
  const service = new MockRequestService();
  const stored = storedReadySession();
  await assert.rejects(() => service.submitRequest({ sessionId: stored.session.id, context: requestContext(stored), contact: { fullName: " ", phone: "123", consentToContact: false }, source: "atlast_web" }), /Invalid contact/);
});

test("malformed retained receipts never count as submitted or unlock mutability", async () => {
  const stored = storedReadySession();
  global.window = memoryWindow(stored);
  const receipt = await receiptFor(stored);
  const malformed = { ...stored, session: { ...stored.session, status: "request_submitted", request: { ...receipt, reference: "MOCK-invalid" } } };
  global.window = memoryWindow(malformed);
  assert.equal(session.hasSubmittedRequest(session.readValuationSession()), false);
  assert.equal(session.markRequestSubmitted(receipt), null);
  assert.throws(() => session.saveValuationSession(stored), /Submitted request cannot be edited/);
});
