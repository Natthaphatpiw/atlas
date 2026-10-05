import { addAnalyticsSink } from "@/adapters/mock/analytics";
import type { AnalyticsEvent } from "@/domain/types";
import { toCanonicalPath } from "@/lib/flow-paths";
import { getLiffAuthToken, reauthenticateLiff } from "@/lib/liff/auth";
import { STAGES, type SessionSnapshot, type StageTimes, type WireEvent } from "@/lib/liff/stages";
import { hasReachedStage, readValuationSession, type StoredValuationSession } from "@/lib/valuation-session";

// Records how a LIFF user moves through the valuation flow: every analytics
// event, the active (on-screen) time spent on each step, the first time each
// valuation stage was reached, and a snapshot of the valuation itself. Events
// are batched to /api/liff/events; leaving the page sends what is queued.

const VISIT_KEY = "atlas.liff.visit";
const OPENED_KEY = "atlas.liff.opened";
const STAGES_KEY = "atlas.liff.stages";
const MAX_QUEUE = 300;
const MAX_BATCH = 50;
const FLUSH_DELAY_MS = 3_000;
const RETRY_DELAY_MS = 15_000;
const CAMPAIGN_PARAMS = ["src", "ref", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

type Properties = NonNullable<WireEvent["properties"]>;

let queue: WireEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let chain: Promise<void> = Promise.resolve();
let started = false;
let step: { path: string; since: number; activeMs: number; visibleSince: number | null } | null = null;
let lastPath: string | null = null;

const storage = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

/** One id per LIFF window, kept across reloads inside it. */
export function liffVisitId(): string {
  const store = storage();
  const existing = store?.getItem(VISIT_KEY);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const id = crypto.randomUUID();
  store?.setItem(VISIT_KEY, id);
  return id;
}

function readStageMap(): Record<string, StageTimes> {
  try {
    const parsed = JSON.parse(storage()?.getItem(STAGES_KEY) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, StageTimes> : {};
  } catch {
    return {};
  }
}

/** Notes the first time the current valuation reached each stage, and returns those times. */
export function observeSession(stored: StoredValuationSession | null = readValuationSession()): StageTimes {
  const id = stored?.session?.id;
  if (!stored || !id) return {};
  const map = readStageMap();
  const times: StageTimes = { ...map[id] };
  let changed = false;
  for (const { key, status } of STAGES) {
    if (times[key] === undefined && hasReachedStage(stored.session.status, status)) {
      times[key] = Date.now();
      changed = true;
    }
  }
  if (changed) {
    const kept = Object.entries({ ...map, [id]: times }).slice(-8);
    storage()?.setItem(STAGES_KEY, JSON.stringify(Object.fromEntries(kept)));
  }
  return times;
}

const primitives = (value: Record<string, unknown>): Properties =>
  Object.fromEntries(Object.entries(value).filter(([, item]) =>
    item === null || ["string", "number", "boolean"].includes(typeof item))) as Properties;

/** The current valuation as reported to Atlas's server, or null before a device is chosen. */
export function sessionSnapshot(stored: StoredValuationSession | null = readValuationSession()): SessionSnapshot | null {
  if (!stored?.device || !stored.session?.id) return null;
  const { session, device } = stored;
  const astly = session.preliminaryValuation?.astly;
  const condition = astly?.condition ?? session.estimateJob?.condition;
  return {
    client_session_id: session.id,
    status: session.status,
    device_id: device.id,
    device_category: device.category,
    device_brand: device.brand,
    device_model: device.model,
    device_specs: primitives({ ...(device.variant ? { variant: device.variant } : {}), ...device.specs }) as Record<string, string>,
    assessment_definition_id: session.assessment?.definitionId,
    assessment_version: session.assessment?.version,
    assessment_answers: session.assessment?.answers,
    condition_score: condition ? Math.min(100, Math.max(0, Math.round(condition.score))) : undefined,
    condition_deductions: condition?.deductions,
    astly_job_id: astly?.jobId ?? session.estimateJob?.jobId,
    estimated_price: astly?.result.estimatedPrice ?? session.preliminaryValuation?.minPrice,
    market_price: astly?.result.marketPrice,
    pawn_price: astly?.result.pawnPrice,
    expected_price: session.expectedPrice?.amount,
    transaction_intent: session.transactionIntent,
    stage_times: observeSession(stored),
  };
}

function scheduleFlush(delay = FLUSH_DELAY_MS) {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flushLiffEvents();
  }, delay);
}

export function trackLiffEvent(name: string, options: { step?: string; durationMs?: number; properties?: Properties; at?: number } = {}) {
  queue.push({
    name,
    step: options.step ?? step?.path,
    at: options.at ?? Date.now(),
    ...(options.durationMs === undefined ? {} : { duration_ms: Math.max(0, Math.round(options.durationMs)) }),
    ...(options.properties ? { properties: options.properties } : {}),
  });
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  scheduleFlush();
}

async function sendBatch(keepalive: boolean): Promise<boolean> {
  const token = getLiffAuthToken();
  if (!token || !queue.length) return false;
  const events = queue.splice(0, MAX_BATCH);
  const body = JSON.stringify({ visitId: liffVisitId(), sentAt: Date.now(), session: sessionSnapshot(), events });
  try {
    const response = await fetch("/api/liff/events", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body,
      cache: "no-store",
      // keepalive lets the request outlive a closing LIFF window; browsers cap its body at 64 KB.
      keepalive: keepalive && body.length < 60_000,
    });
    if (response.status === 401 && !keepalive && await reauthenticateLiff()) {
      // Atlas's session token expired and was renewed: send this batch again.
      queue = [...events, ...queue].slice(-MAX_QUEUE);
      return true;
    }
    if (response.status === 429 || response.status >= 500) throw new Error(String(response.status));
    // Stored, or a 4xx that resending cannot fix: either way the batch is done.
    return true;
  } catch {
    queue = [...events, ...queue].slice(-MAX_QUEUE);
    if (!keepalive) scheduleFlush(RETRY_DELAY_MS);
    return false;
  }
}

/** Sends everything queued, one batch at a time. */
export function flushLiffEvents(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  chain = chain.then(async () => {
    while (queue.length && await sendBatch(false)) { /* next batch */ }
  });
  return chain;
}

function flushOnExit() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  void sendBatch(true);
}

function leaveStep(reason: "navigate" | "hidden" | "closed", next?: string) {
  if (!step) return;
  const now = Date.now();
  const activeMs = step.activeMs + (step.visibleSince === null ? 0 : now - step.visibleSince);
  trackLiffEvent("step_left", {
    step: step.path,
    durationMs: activeMs,
    properties: { reason, wallMs: now - step.since, ...(next ? { to: next } : {}) },
  });
}

/** Records arriving on a flow step (a web flow path such as "/valuation/result"). */
export function enterStep(path: string) {
  if (step?.path === path) return;
  const previous = step?.path;
  leaveStep("navigate", path);
  lastPath = path;
  const now = Date.now();
  step = { path, since: now, activeMs: 0, visibleSince: document.visibilityState === "visible" ? now : null };
  trackLiffEvent("step_viewed", { step: path, properties: previous ? { from: previous } : {} });
  observeSession();
  void flushLiffEvents();
}

function onVisibilityChange() {
  if (!step) return;
  if (document.visibilityState === "hidden") {
    if (step.visibleSince === null) return;
    // The user may never come back (LIFF closed, app switched): close the stay now.
    leaveStep("hidden");
    step = { path: step.path, since: Date.now(), activeMs: 0, visibleSince: null };
    flushOnExit();
  } else if (step.visibleSince === null) {
    step = { path: step.path, since: Date.now(), activeMs: 0, visibleSince: Date.now() };
    trackLiffEvent("step_viewed", { step: step.path, properties: { resumed: true } });
  }
}

function recordAnalyticsEvent(event: AnalyticsEvent) {
  const { eventName, timestamp, route, sessionId, ...rest } = event;
  void sessionId;
  const at = Date.parse(timestamp);
  trackLiffEvent(eventName, { step: route, at: Number.isFinite(at) ? at : undefined, properties: primitives(rest) });
  observeSession();
  if (["valuation_calculated", "valuation_failed", "transaction_intent_selected", "valuation_request_submitted"].includes(eventName)) {
    void flushLiffEvents();
  }
}

function campaign(): Properties {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(CAMPAIGN_PARAMS.flatMap((key) => {
    const value = params.get(key);
    return value ? [[key, value.slice(0, 120)]] : [];
  }));
}

/** Starts recording for this page once Atlas's LIFF session token is set. Safe to call again. */
export function startLiffTracking(environment: Properties) {
  if (started) return;
  started = true;
  addAnalyticsSink(recordAnalyticsEvent);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", () => {
    leaveStep("closed");
    step = null;
    flushOnExit();
  });
  // Restored from the back-forward cache: the step the user left is showing again.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && !step && lastPath) enterStep(lastPath);
  });
  const visitId = liffVisitId();
  if (storage()?.getItem(OPENED_KEY) !== visitId) {
    storage()?.setItem(OPENED_KEY, visitId);
    trackLiffEvent("liff_opened", { step: toCanonicalPath(window.location.pathname), properties: { ...environment, ...campaign() } });
  } else {
    trackLiffEvent("liff_reloaded", { properties: environment });
  }
}
