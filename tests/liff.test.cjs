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
const { MockRequestService, toReceiptContext } = require("../adapters/mock/request.ts");
const paths = require("../lib/flow-paths.ts");
const { stageNumber } = require("../lib/liff/stages.ts");
const { estimateRequestBody } = require("../lib/estimate-request-body.ts");
const { parseEstimateRequest } = require("../lib/estimate-request.ts");
const liffAuth = require("../lib/server/liff-auth.ts");
const liffEvents = require("../lib/server/liff-events.ts");
const line = require("../lib/server/line-messaging.ts");
const visitor = require("../lib/server/visitor.ts");
const { withoutNul } = require("../lib/server/atlas-db.ts");
const { usedMarketPrice } = require("../lib/used-price.ts");
const eventsRoute = require("../app/api/liff/events/route.ts");
const session = require("../lib/valuation-session.ts");
const requestsRoute = require("../app/api/liff/requests/route.ts");

const originalFetch = global.fetch;
const originalEnv = { ...process.env };
test.after(() => {
  Module._resolveFilename = originalResolve;
  require.extensions[".ts"] = originalTsLoader;
  global.fetch = originalFetch;
  process.env = originalEnv;
  delete global.window;
});

const USER = "U0123456789abcdef0123456789abcdef";
const VISIT = "11111111-1111-4111-8111-111111111111";
const JOB = "0f8fad5b-d9cb-469f-a165-70867728950e";
const iphone = mockDevices.find((device) => device.id === "device-iphone-15-pro");
const answer = (questionId, value) => ({ questionId, value, answeredAt: "2026-10-05T00:00:00.000Z" });

function healthyAnswers(device) {
  const definition = getMockAssessment(device);
  const good = (question) => {
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

function configure() {
  process.env.ATLAS_VISITOR_SECRET = "s".repeat(40);
  process.env.ASTLY_DEMO_API_KEY = "k".repeat(40);
  process.env.SUPABASE_URL = "https://db.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN = "line-token";
  process.env.LINE_LOGIN_CHANNEL_ID = "2011873191";
}

test("flow paths map the web flow onto the LIFF copy and back", () => {
  assert.equal(paths.toFlowPath("", "/valuation/device"), "/valuation/device");
  assert.equal(paths.toFlowPath("/liff", "/valuation/device"), "/liff/valuation/device");
  assert.equal(paths.toFlowPath("/liff", "/"), "/liff");
  assert.equal(paths.toCanonicalPath("/liff"), "/");
  assert.equal(paths.toCanonicalPath("/liff/valuation/lead"), "/valuation/lead");
  assert.equal(paths.toCanonicalPath("/valuation/lead"), "/valuation/lead");
  assert.equal(paths.isLiffPath("/liffy"), false, "only the /liff segment counts");
  assert.equal(stageNumber("device_selected"), 1);
  assert.equal(stageNumber("request_submitted"), 6);
  assert.equal(stageNumber("draft"), 0);
});

test("LIFF session tokens are signed, expire and name one LINE user", () => {
  configure();
  const now = Date.now();
  const { token, expiresAt } = liffAuth.issueLiffSession({ userId: USER, mock: false }, now);
  const request = (value) => new Request("https://atlas.test/api", { headers: value ? { authorization: `Bearer ${value}` } : {} });
  assert.deepEqual(liffAuth.readLiffSession(request(token), now), { userId: USER, mock: false });
  assert.equal(liffAuth.readLiffSession(request(token), expiresAt + 1), null, "expires");
  const [payload, signature] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ u: "U" + "f".repeat(32), e: expiresAt })).toString("base64url");
  assert.equal(liffAuth.readLiffSession(request(`${forged}.${signature}`), now), null, "payload is signed");
  assert.equal(liffAuth.readLiffSession(request(`${payload}.${signature}x`), now), null);
  assert.equal(liffAuth.readLiffSession(request(null), now), null);
  process.env.ATLAS_VISITOR_SECRET = "t".repeat(40);
  assert.equal(liffAuth.readLiffSession(request(token), now), null, "rotating the secret ends sessions");
  process.env.ATLAS_VISITOR_SECRET = "";
  assert.equal(liffAuth.readLiffSession(request(token), now), null, "no secret, no session");
});

test("mock LINE identities work only when enabled outside production", async () => {
  configure();
  process.env.ATLAS_LIFF_MOCK_AUTH = "true";
  process.env.NODE_ENV = "development";
  assert.deepEqual(await liffAuth.verifyLineIdToken(`mock:${USER}`), { userId: USER, displayName: "Atlas Dev", mock: true });
  const mock = liffAuth.issueLiffSession({ userId: USER, mock: true });
  const request = new Request("https://atlas.test/api", { headers: { authorization: `Bearer ${mock.token}` } });
  assert.equal(liffAuth.readLiffSession(request).mock, true);

  process.env.NODE_ENV = "production";
  await assert.rejects(liffAuth.verifyLineIdToken(`mock:${USER}`), (error) => error.status === 401);
  assert.equal(liffAuth.readLiffSession(request), null, "a mock session dies with mock mode");
  process.env.NODE_ENV = "development";
  delete process.env.ATLAS_LIFF_MOCK_AUTH;
  await assert.rejects(liffAuth.verifyLineIdToken(`mock:${USER}`), (error) => error.status === 401);
});

test("LINE ID tokens are verified with LINE for the Atlas login channel", async () => {
  configure();
  const calls = [];
  const claims = { iss: "https://access.line.me", sub: USER, aud: "2011873191", exp: Math.floor(Date.now() / 1000) + 600, name: "Somchai", picture: "https://profile.line-scdn.net/p" };
  global.fetch = async (url, init) => {
    calls.push({ url, body: String(init.body) });
    const token = new URLSearchParams(String(init.body)).get("id_token");
    if (token === "eyJ.valid.0001") return Response.json(claims);
    if (token === "eyJ.otheraud.1") return Response.json({ ...claims, aud: "9999999999" });
    return Response.json({ error: "invalid_request" }, { status: 400 });
  };
  const identity = await liffAuth.verifyLineIdToken("eyJ.valid.0001");
  assert.deepEqual(identity, { userId: USER, displayName: "Somchai", pictureUrl: "https://profile.line-scdn.net/p", mock: false });
  assert.equal(calls[0].url, "https://api.line.me/oauth2/v2.1/verify");
  assert.match(calls[0].body, /client_id=2011873191/);
  await liffAuth.verifyLineIdToken("eyJ.valid.0001");
  assert.equal(calls.length, 1, "a verified token is cached until it expires");
  await assert.rejects(liffAuth.verifyLineIdToken("eyJ.expired.001"), (error) => error.status === 401);
  await assert.rejects(liffAuth.verifyLineIdToken("eyJ.otheraud.1"), (error) => error.status === 401);
  await assert.rejects(liffAuth.verifyLineIdToken(42), (error) => error.status === 400);
  const before = calls.length;
  await assert.rejects(liffAuth.verifyLineIdToken("not a jwt at all"), (error) => error.status === 401);
  assert.equal(calls.length, before, "junk never reaches LINE");

  delete process.env.LINE_LOGIN_CHANNEL_ID;
  process.env.NEXT_PUBLIC_LIFF_ID = "2011873191-6AQ7I8vq";
  assert.equal(liffAuth.lineLoginChannelId(), "2011873191", "falls back to the LIFF ID's channel");
  delete process.env.NEXT_PUBLIC_LIFF_ID;
  assert.equal(liffAuth.lineLoginChannelId(), null);
});

test("estimate tickets carry what they priced, and LINE users are their own visitors", () => {
  configure();
  const { definition, answers } = healthyAnswers(iphone);
  const input = parseEstimateRequest(estimateRequestBody(iphone, { definitionId: definition.id, version: definition.version, answers }));
  const hash = visitor.estimateInputHash(input);
  const ticket = visitor.issueEstimateTicket(JOB, "visitor_0000000000000000000000000", Date.now(), hash);
  assert.deepEqual(visitor.readEstimateTicketClaims(ticket, JOB), { visitor: "visitor_0000000000000000000000000", inputHash: hash });
  assert.equal(visitor.readEstimateTicket(ticket, JOB), "visitor_0000000000000000000000000", "polling still reads the visitor");
  assert.deepEqual(visitor.readEstimateTicketClaims(visitor.issueEstimateTicket(JOB, "v"), JOB), { visitor: "v" }, "older tickets have no input");
  assert.notEqual(visitor.estimateInputHash({ ...input, capacity: "1TB" }), hash);
  const lineVisitor = visitor.lineVisitorId(USER);
  assert.equal(lineVisitor.length, 32);
  assert.equal(visitor.lineVisitorId(USER), lineVisitor);
  assert.notEqual(visitor.lineVisitorId("U" + "f".repeat(32)), lineVisitor);
});

test("price receipts vouch for one job's price for one priced input", () => {
  configure();
  const now = Date.now();
  const price = { estimatedPrice: 21500, marketPrice: 40000, pawnPrice: 24000, condition: 0.9 };
  const receipt = visitor.issuePriceReceipt(JOB, "hash-a", { ...price, confidence: 0.85 }, now);
  assert.deepEqual(visitor.readPriceReceipt(receipt, JOB, "hash-a", now), price);
  assert.equal(visitor.readPriceReceipt(receipt, JOB, "hash-b", now), null, "bound to the priced input");
  assert.equal(visitor.readPriceReceipt(receipt, "1f8fad5b-d9cb-469f-a165-70867728950e", "hash-a", now), null, "bound to its job");
  assert.equal(visitor.readPriceReceipt(receipt, JOB, "hash-a", now + 25 * 60 * 60 * 1000), null, "expires after a day");
  const [payload, signature] = receipt.split(".");
  const raised = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url")), e: 99999 })).toString("base64url");
  assert.equal(visitor.readPriceReceipt(`${raised}.${signature}`, JOB, "hash-a", now), null, "the price is signed");
  const ticket = visitor.issueEstimateTicket(JOB, "v", now, "hash-a");
  assert.equal(visitor.readPriceReceipt(ticket, JOB, "hash-a", now), null, "a ticket is not a receipt");
  assert.equal(visitor.readPriceReceipt(undefined, JOB, "hash-a", now), null);
});

test("sellers are shown a used-market price, never Astly's lending figure", () => {
  assert.equal(usedMarketPrice({ marketPrice: 40000, condition: 1 }), 40000, "a flawless device gets the market price");
  assert.equal(usedMarketPrice({ marketPrice: 40000, condition: 0.85 }), 34000);
  assert.equal(usedMarketPrice({ marketPrice: 12345, condition: 0.9 }), 11100, "to the nearest 100 THB");
  assert.equal(usedMarketPrice({ marketPrice: 40000, condition: 1.4 }), 40000, "condition is capped at 1");
  assert.equal(usedMarketPrice({ marketPrice: 40000, condition: Number.NaN }), 40000);
  assert.equal(usedMarketPrice({ marketPrice: 0, condition: 1 }), 0, "no market price, no offer");
  const cheap = visitor.issuePriceReceipt(JOB, "hash-a", { estimatedPrice: 0, marketPrice: 900, pawnPrice: 540, condition: 0.8 });
  assert.equal(visitor.readPriceReceipt(cheap, JOB, "hash-a").marketPrice, 900, "a receipt holds even when Astly's lending figure snapped to 0");
  const worthless = visitor.issuePriceReceipt(JOB, "hash-a", { estimatedPrice: 0, marketPrice: 40000, pawnPrice: 24000, condition: 0 });
  assert.equal(visitor.readPriceReceipt(worthless, JOB, "hash-a"), null, "a result with no used-market price verifies nothing");
});

test("a valuation saved before used-market prices sends the seller back to Result to refresh it", () => {
  const stored = readyToSubmit();
  const result = { estimatedPrice: 21500, marketPrice: 40000, pawnPrice: 24000, condition: 0.9, confidence: 0.85, loanToValue: 0.6, productName: "", calculation: { marketPrice: "", pawnPrice: "", finalPrice: "" }, completedAt: "2026-10-05T00:00:00.000Z" };
  stored.session.preliminaryValuation = { minPrice: 21500, maxPrice: 21500, currency: "THB", source: "astly", astly: { jobId: JOB, requestKey: "k", condition: { score: 90, deductions: [] }, result } };
  assert.equal(session.hasPreliminaryValuation(stored), false, "Astly's lending figure is not a shown price");
  stored.session.preliminaryValuation = { ...stored.session.preliminaryValuation, minPrice: 36000, maxPrice: 36000 };
  assert.equal(session.hasPreliminaryValuation(stored), true);
  const submitted = { ...stored, session: { ...stored.session, request: { id: "x" }, preliminaryValuation: { ...stored.session.preliminaryValuation, minPrice: 21500, maxPrice: 21500 } } };
  assert.equal(session.hasPreliminaryValuation(submitted), true, "a submitted request keeps the price it was submitted with");
});

test("database writes drop NUL characters Postgres cannot store", () => {
  assert.deepEqual(withoutNul({ src: "fb\u0000", list: ["a\u0000b", 1, null], ["k\u0000"]: true }), { src: "fb", list: ["ab", 1, null], k: true });
});

test("reported events are bounded and moved onto the server clock", () => {
  const now = Date.parse("2026-10-05T10:00:00.000Z");
  assert.equal(liffEvents.clockOffsetMs(now - 500, now), 0, "latency-sized skew is ignored");
  const offset = liffEvents.clockOffsetMs(now - 60_000, now);
  assert.equal(offset, 60_000, "a phone clock one minute slow");
  assert.equal(liffEvents.toServerTime(now - 60_000 - 1_000, offset, now), "2026-10-05T09:59:59.000Z");
  assert.equal(liffEvents.toServerTime(now + 60_000, 0, now), undefined, "future times are rejected");
  assert.equal(liffEvents.toServerTime(now - 40 * 86_400_000, 0, now), undefined, "ancient times are rejected");

  const events = liffEvents.sanitizeEvents([
    { name: "step_left", step: "/valuation/result", at: now - 1_000, duration_ms: 4_200.4, properties: { reason: "navigate", nested: { no: 1 }, "bad key": 1, wallMs: 5000 } },
    { name: "Robert'); DROP TABLE", at: now },
    { name: "valuation_calculated", step: "javascript:alert(1)", at: "yesterday" },
  ], 0, now);
  assert.equal(events.length, 2);
  assert.deepEqual(events[0], { name: "step_left", step: "/valuation/result", occurred_at: "2026-10-05T09:59:59.000Z", duration_ms: null, properties: { reason: "navigate", wallMs: 5000 } });
  assert.equal(events[1].step, null);
  assert.equal(events[1].occurred_at, new Date(now).toISOString());
  assert.equal(liffEvents.sanitizeEvents(new Array(51).fill({ name: "x_y", at: now }), 0, now), null, "batches are capped");
  assert.equal(liffEvents.isVisitId(VISIT), true);
  assert.equal(liffEvents.isVisitId("not-a-uuid"), false);

  const snapshot = liffEvents.sanitizeSnapshot({
    client_session_id: "session-1759658400000",
    status: "transaction_intent_selected",
    device_id: "device-iphone-15-pro", device_category: "phone", device_brand: "Apple", device_model: "iPhone 15 Pro",
    device_specs: { storage: "256GB", color: { evil: true } },
    condition_score: 85, estimated_price: 21500, expected_price: 25000, transaction_intent: "sell_and_repurchase",
    astly_job_id: "<script>",
    stage_times: { device_selected: now - 300_000, valued: now - 60_000, bogus: now, intent_selected: now + 3_600_000 },
  }, 0, now);
  assert.equal(snapshot.stage, 5, "the stage is derived from the status, not reported");
  assert.deepEqual(snapshot.device_specs, { storage: "256GB" });
  assert.equal(snapshot.astly_job_id, undefined);
  assert.deepEqual(snapshot.stage_times, { device_selected: "2026-10-05T09:55:00.000Z", valued: "2026-10-05T09:59:00.000Z" });
  assert.equal(liffEvents.sanitizeSnapshot({ client_session_id: "s", status: "device_selected" }, 0, now), null, "a snapshot needs a device");
  assert.equal(liffEvents.sanitizeSnapshot({ ...snapshot, transaction_intent: "rent" }, 0, now).transaction_intent, undefined);

  assert.equal(liffEvents.allowEvents("U1", 400, now), true);
  assert.equal(liffEvents.allowEvents("U1", 300, now + 1_000), false, "a flood is cut off");
  assert.equal(liffEvents.allowEvents("U1", 10, now + 11 * 60_000), true, "the window resets");
});

test("the LINE confirmation names the product, prices, sale type, time and reference", () => {
  const message = line.saleRequestConfirmationMessage({
    reference: "ATL-1A2B3C4D", productName: "Apple iPhone 15 Pro", productDetails: "256GB · Natural Titanium",
    transactionIntent: "sell_and_repurchase", estimatedPrice: 21500, expectedPrice: 25000,
    submittedAt: new Date("2026-10-05T09:09:00.000Z"),
  });
  const texts = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") {
      if (node.type === "text") texts.push(node.text);
      Object.values(node).forEach(walk);
    }
  };
  walk(message.contents);
  assert.equal(message.type, "flex");
  assert.ok(message.altText.length <= 400 && message.altText.includes("Apple iPhone 15 Pro"));
  assert.ok(texts.every((value) => typeof value === "string" && value.length > 0), "LINE rejects empty text");
  for (const expected of ["Apple iPhone 15 Pro", "฿21,500", "฿25,000", "ขายฝาก", "ATL-1A2B3C4D", "5 ต.ค. 2569 เวลา 16:09 น."]) {
    assert.ok(texts.includes(expected), `shows ${expected}`);
  }

  const unverified = line.saleRequestConfirmationMessage({
    reference: "ATL-1A2B3C4D", productName: "Apple iPhone 15 Pro", transactionIntent: "outright_sale",
    estimatedPrice: null, expectedPrice: 25000, submittedAt: new Date("2026-10-05T09:09:00.000Z"),
  });
  const json = JSON.stringify(unverified);
  assert.ok(json.includes("ทีมงานจะยืนยันอีกครั้ง") && json.includes("ขายขาด"), "an unverified price is never quoted");
  assert.ok(!unverified.altText.includes("ราคาประเมิน"));
});

test("pushes are idempotent per request, and a dry run only validates", async () => {
  configure();
  const calls = [];
  let status = 200;
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(status === 200 ? "{}" : JSON.stringify({ message: "The request body has 1 error(s)" }), { status });
  };
  const retryKey = "869846c9-6bae-4b81-9587-839301b29c9c";
  assert.deepEqual(await line.pushLineMessages(USER, [{ type: "text", text: "hi" }], { retryKey }), { status: "sent" });
  assert.equal(calls[0].url, "https://api.line.me/v2/bot/message/push");
  assert.equal(calls[0].init.headers["x-line-retry-key"], retryKey);
  assert.equal(JSON.parse(calls[0].init.body).to, USER);

  await line.pushLineMessages(USER, [{ type: "text", text: "hi" }], { retryKey, dryRun: true });
  assert.equal(calls[1].url, "https://api.line.me/v2/bot/message/validate/push");
  assert.equal(JSON.parse(calls[1].init.body).to, undefined);

  status = 409;
  assert.deepEqual(await line.pushLineMessages(USER, [], { retryKey }), { status: "sent" }, "already accepted");
  status = 400;
  assert.equal((await line.pushLineMessages(USER, [], { retryKey })).status, "failed");
  delete process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  assert.equal((await line.pushLineMessages(USER, [], { retryKey })).status, "skipped");
  assert.equal(await line.getFriendStatus(USER), null, "unknown without a token");
});

test("friendship is read from the OA's view of the user", async () => {
  configure();
  for (const [status, expected] of [[200, { isFriend: true }], [404, { isFriend: false }], [500, null]]) {
    global.fetch = async (url) => {
      assert.equal(url, `https://api.line.me/v2/bot/profile/${USER}`);
      return new Response("{}", { status });
    };
    assert.deepEqual(await line.getFriendStatus(USER), expected);
  }
});

function memoryWindow(initial) {
  const entries = new Map(initial ? [["atlast.valuation.session", JSON.stringify(initial)]] : []);
  return { sessionStorage: { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: (key) => entries.delete(key) } };
}

function readyToSubmit() {
  const { definition, answers } = healthyAnswers(iphone);
  const stored = session.createDeviceSession(iphone);
  stored.session.status = "transaction_intent_selected";
  stored.session.assessment = { definitionId: definition.id, version: definition.version, source: "seller_reported", answers, reviewedAt: "2026-10-05T00:00:00.000Z" };
  stored.session.preliminaryValuation = { minPrice: 21500, maxPrice: 21500, currency: "THB", source: "astly" };
  stored.session.expectedPrice = { amount: 25000, currency: "THB", enteredBy: "seller", source: "manual_entry", createdAt: "2026-10-05T00:00:00.000Z" };
  stored.session.transactionIntent = "outright_sale";
  return stored;
}

test("a LIFF receipt (ATL-, LINE connected) locks the session like a web receipt", async () => {
  const stored = readyToSubmit();
  global.window = memoryWindow(stored);
  const input = { sessionId: stored.session.id, context: { device: stored.device, assessment: stored.session.assessment,
    preliminaryValuation: stored.session.preliminaryValuation, expectedPrice: stored.session.expectedPrice,
    transactionIntent: "outright_sale" }, contact: { fullName: "A", phone: "0812345678", consentToContact: true }, source: "atlast_web" };
  const liffReceipt = { id: "869846c9-6bae-4b81-9587-839301b29c9c", reference: "ATL-1A2B3C4D", sessionId: stored.session.id, state: "submitted",
    submittedAt: "2026-10-05T09:09:00.000Z", lineConnection: "line_connected", lineNotified: true, context: toReceiptContext(input.context) };
  assert.equal(session.markRequestSubmitted({ ...liffReceipt, lineConnection: "prototype_pending" }), null, "an ATL reference must be LINE connected");
  assert.equal(session.markRequestSubmitted({ ...liffReceipt, reference: "MOCK-1A2B3C4D" }), null, "a MOCK reference is never LINE connected");
  const submitted = session.markRequestSubmitted(liffReceipt);
  assert.ok(submitted && session.hasSubmittedRequest(submitted));
  assert.throws(() => session.saveValuationSession(stored), /cannot be edited/);

  global.window = memoryWindow(readyToSubmit());
  const webReceipt = await new MockRequestService().submitRequest({ ...input, sessionId: session.readValuationSession().session.id });
  assert.match(webReceipt.reference, /^MOCK-/);
  assert.equal(webReceipt.lineConnection, "prototype_pending");
});

test("submitting stores a checked request once and confirms it in LINE", async () => {
  configure();
  const { definition, answers } = healthyAnswers(iphone);
  const body = estimateRequestBody(iphone, { definitionId: definition.id, version: definition.version, answers });
  const input = parseEstimateRequest(body);
  const lineVisitor = visitor.lineVisitorId(USER);
  const ticket = visitor.issueEstimateTicket(JOB, lineVisitor, Date.now(), visitor.estimateInputHash(input));
  const { token } = liffAuth.issueLiffSession({ userId: USER, mock: false });

  const calls = [];
  let created = true;
  let pushStatus = "sent";
  let friend = 200;
  global.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url) === `https://api.line.me/v2/bot/profile/${USER}`) return new Response("{}", { status: friend });
    if (String(url).startsWith("https://www.astly.co/api/demo/estimate/")) {
      return Response.json({ status: "COMPLETED", pollAfterMs: 4000, result: { estimatedPrice: 21500, marketPrice: 40000, pawnPrice: 24000, condition: 0.9, confidence: 0.85, loanToValue: 0.6, productName: "Apple iPhone 15 Pro 256GB", calculation: {}, completedAt: "2026-10-05T09:00:00.000Z" } });
    }
    if (String(url).endsWith("/rest/v1/rpc/atlas_submit_sale_request")) {
      return Response.json([{ request_id: "869846c9-6bae-4b81-9587-839301b29c9c", reference: "ATL-1A2B3C4D", created, created_at: "2026-10-05T09:09:00+00:00", line_push_status: created ? "pending" : pushStatus }]);
    }
    if (String(url).includes("/rest/v1/atlas_sale_requests?id=eq.")) return new Response(null, { status: 204 });
    if (String(url) === "https://api.line.me/v2/bot/message/push") return Response.json({ sentMessages: [] });
    throw new Error(`unexpected fetch ${url}`);
  };

  const submit = (overrides = {}) => requestsRoute.POST(new Request("https://atlas.test/api/liff/requests", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      visitId: VISIT,
      sentAt: Date.now(),
      session: { client_session_id: "session-1", status: "transaction_intent_selected", device_id: "spoofed", device_category: "phone",
        device_brand: "Spoof", device_model: "Spoof", device_specs: {}, condition_score: 100, stage_times: { device_selected: Date.now() - 60_000 } },
      ...body,
      estimate: { jobId: JOB, ticket, estimatedPrice: 99_999 },
      expectedPrice: 25000,
      transactionIntent: "sell_and_repurchase",
      contact: { fullName: " สมชาย ใจดี ", phone: "081-234-5678", consentToContact: true,
        address: { line: " 99/1 ถนนสุขุมวิท  แขวงคลองตัน เขตคลองเตย กรุงเทพฯ ", postcode: "10110" } },
      ...overrides,
    }),
  }));

  const response = await submit();
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { id: "869846c9-6bae-4b81-9587-839301b29c9c", reference: "ATL-1A2B3C4D", submittedAt: "2026-10-05T09:09:00+00:00", lineNotified: true });

  const astlyCall = calls.find((call) => call.url.startsWith("https://www.astly.co/"));
  assert.equal(astlyCall.init.headers["x-demo-visitor"], lineVisitor, "the job is re-read as the visitor that started it");
  const rpc = JSON.parse(calls.find((call) => call.url.endsWith("atlas_submit_sale_request")).init.body).p_payload;
  assert.equal(rpc.request.estimated_price, 36000, "the used-market price from Astly's result (40,000 at condition 0.9), not the browser's claim");
  assert.equal(rpc.request.estimate_verified, true);
  assert.equal(rpc.request.condition_score, 90, "a verified row takes the condition from Astly, not the browser");
  assert.deepEqual(rpc.request.condition_deductions, []);
  assert.equal(rpc.request.contact_phone, "0812345678");
  assert.equal(rpc.request.contact_name, "สมชาย ใจดี");
  assert.equal(rpc.request.contact_address, "99/1 ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย กรุงเทพฯ", "ขายฝาก stores the address");
  assert.equal(rpc.request.contact_postcode, "10110");
  assert.equal(rpc.request.product_name, "Apple iPhone 15 Pro");
  assert.equal(rpc.ingest.user.line_user_id, USER, "the user comes from the session token");
  assert.equal(rpc.ingest.session.device_model, "iPhone 15 Pro", "the stored snapshot uses the validated device");
  assert.equal(rpc.ingest.session.estimated_price, 36000);
  const push = calls.find((call) => call.url === "https://api.line.me/v2/bot/message/push");
  assert.equal(push.init.headers["x-line-retry-key"], "869846c9-6bae-4b81-9587-839301b29c9c");
  assert.match(JSON.parse(push.init.body).messages[0].altText, /Apple iPhone 15 Pro/);
  const patch = calls.find((call) => call.url.includes("atlas_sale_requests?id=eq."));
  assert.equal(JSON.parse(patch.init.body).line_push_status, "sent");

  calls.length = 0;
  created = false;
  const repeat = await submit();
  assert.equal(repeat.status, 200);
  assert.equal((await repeat.json()).lineNotified, true);
  assert.ok(!calls.some((call) => call.url.includes("/message/push")), "a repeated submit never messages twice");

  calls.length = 0;
  pushStatus = "failed";
  const retried = await submit();
  assert.equal((await retried.json()).lineNotified, true, "a failed push is retried on resubmit");
  const retryPush = calls.find((call) => call.url === "https://api.line.me/v2/bot/message/push");
  assert.equal(retryPush.init.headers["x-line-retry-key"], "869846c9-6bae-4b81-9587-839301b29c9c", "with the same retry key");
  pushStatus = "sent";

  calls.length = 0;
  created = true;
  const receipt = visitor.issuePriceReceipt(JOB, visitor.estimateInputHash(input), { estimatedPrice: 22000, marketPrice: 41000, pawnPrice: 24600, condition: 0.9 });
  await submit({ estimate: { jobId: JOB, priceReceipt: receipt, estimatedPrice: 1 } });
  const byReceipt = JSON.parse(calls.find((call) => call.url.endsWith("atlas_submit_sale_request")).init.body).p_payload;
  assert.equal(byReceipt.request.estimate_verified, true);
  assert.equal(byReceipt.request.estimated_price, 36900, "a price receipt verifies without asking Astly (41,000 at condition 0.9)");
  assert.ok(!calls.some((call) => call.url.startsWith("https://www.astly.co/")));

  calls.length = 0;
  created = true;
  const otherDevice = visitor.estimateInputHash({ ...input, capacity: "1TB" });
  const foreignTicket = visitor.issueEstimateTicket(JOB, lineVisitor, Date.now(), otherDevice);
  await submit({ estimate: { jobId: JOB, ticket: foreignTicket, estimatedPrice: 20000 } });
  const unverified = JSON.parse(calls.find((call) => call.url.endsWith("atlas_submit_sale_request")).init.body).p_payload;
  assert.equal(unverified.request.estimate_verified, false, "a ticket for another configuration proves nothing");
  assert.equal(unverified.request.estimated_price, 20000);
  assert.ok(!calls.some((call) => call.url.startsWith("https://www.astly.co/")));
  const unverifiedPush = JSON.parse(calls.find((call) => call.url === "https://api.line.me/v2/bot/message/push").init.body);
  assert.ok(!JSON.stringify(unverifiedPush).includes("฿20,000"), "an unverified price is stored but never sent from the OA");

  calls.length = 0;
  const zero = visitor.issuePriceReceipt(JOB, visitor.estimateInputHash(input), { estimatedPrice: 0, marketPrice: 40000, pawnPrice: 24000, condition: 0 });
  await submit({ estimate: { jobId: JOB, priceReceipt: zero, estimatedPrice: 99999 } });
  const zeroRow = JSON.parse(calls.find((call) => call.url.endsWith("atlas_submit_sale_request")).init.body).p_payload;
  assert.equal(zeroRow.request.estimate_verified, false, "a worthless result never marks the browser's price as verified");

  // ขายฝาก without a valid address is refused; an outright sale never stores one.
  const fullContact = { fullName: "สมชาย ใจดี", phone: "0812345678", consentToContact: true };
  assert.equal((await submit({ contact: fullContact })).status, 400, "ขายฝาก needs an address");
  assert.equal((await submit({ contact: { ...fullContact, address: { line: "99/1 ถนนสุขุมวิท กรุงเทพฯ", postcode: "00000" } } })).status, 400);
  calls.length = 0;
  await submit({ transactionIntent: "outright_sale", contact: { ...fullContact, address: { line: "99/1 ถนนสุขุมวิท กรุงเทพฯ", postcode: "10110" } } });
  const outright = JSON.parse(calls.find((call) => call.url.endsWith("atlas_submit_sale_request")).init.body).p_payload;
  assert.equal(outright.request.contact_address, undefined, "an outright sale stores no address");
  assert.equal(outright.request.contact_postcode, undefined);

  calls.length = 0;
  friend = 404;
  assert.equal((await submit()).status, 403, "the add-friend requirement holds at the API too");
  assert.ok(!calls.some((call) => call.url.endsWith("atlas_submit_sale_request")));
  friend = 200;

  assert.equal((await submit({ contact: { fullName: "A", phone: "12345", consentToContact: true } })).status, 400);
  assert.equal((await submit({ contact: { fullName: "A", phone: "0812345678", consentToContact: false } })).status, 400);
  assert.equal((await submit({ transactionIntent: "rent" })).status, 400);
  assert.equal((await submit({ deviceId: "device-unknown" })).status, 400);
  assert.equal((await submit({ expectedPrice: -5 })).status, 400);
  const anonymous = await requestsRoute.POST(new Request("https://atlas.test/api/liff/requests", { method: "POST", body: "{}" }));
  assert.equal(anonymous.status, 401);
});

test("events the database refuses are dropped, not resent forever", async () => {
  configure();
  const { token } = liffAuth.issueLiffSession({ userId: USER, mock: false });
  const post = () => eventsRoute.POST(new Request("https://atlas.test/api/liff/events", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ visitId: VISIT, sentAt: Date.now(), events: [{ name: "liff_opened", at: Date.now() }] }),
  }));
  let status = 400;
  global.fetch = async () => Response.json({ code: "22P05" }, { status });
  assert.equal((await post()).status, 422);
  status = 500;
  assert.equal((await post()).status, 503, "a database outage is worth retrying");
  status = 200;
  assert.equal((await post()).status, 204);
});

test("polling a finished estimate returns a price receipt for its priced input", async () => {
  configure();
  const pollRoute = require("../app/api/valuation/estimate/[jobId]/route.ts");
  global.fetch = async () => Response.json({ status: "COMPLETED", pollAfterMs: 4000, result: { estimatedPrice: 21500, marketPrice: 40000, pawnPrice: 24000, condition: 0.9, confidence: 0.85, loanToValue: 0.6, productName: "x", calculation: {}, completedAt: "2026-10-05T09:00:00.000Z" } });
  const poll = (ticket) => pollRoute.GET(new Request(`https://atlas.test/api/valuation/estimate/${JOB}`, { headers: { "x-estimate-ticket": ticket } }), { params: Promise.resolve({ jobId: JOB }) });
  const state = await (await poll(visitor.issueEstimateTicket(JOB, "v", Date.now(), "hash-a"))).json();
  assert.deepEqual(visitor.readPriceReceipt(state.priceReceipt, JOB, "hash-a"), { estimatedPrice: 21500, marketPrice: 40000, pawnPrice: 24000, condition: 0.9 });
  const legacy = await (await poll(visitor.issueEstimateTicket(JOB, "v"))).json();
  assert.equal(legacy.priceReceipt, undefined, "no receipt without a priced input to bind it to");
});
