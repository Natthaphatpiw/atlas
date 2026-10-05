// Server-side validation of what the LIFF app reports. The browser is not
// trusted: every field is type-checked, bounded and re-derived where it can be,
// and client timestamps are shifted onto the server clock.
import { STAGES, stageNumber, type SessionSnapshot, type WireEvent } from "@/lib/liff/stages";

export const MAX_EVENTS_PER_BATCH = 50;
const MAX_EVENT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_PRICE = 100_000_000;
const DEVICE_CATEGORIES = ["phone", "tablet", "laptop", "desktop", "watch", "audio", "other"];
const STATUSES = ["draft", "device_selected", "condition_completed", "preliminary_valuation_available", "expected_price_entered",
  "transaction_intent_selected", "estimated", "lead_collected", "handoff_ready", "request_submitted"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number, pattern?: RegExp) =>
  typeof value === "string" && value.length > 0 && value.length <= max && (!pattern || pattern.test(value)) ? value : undefined;
const int = (value: unknown, min: number, max: number) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max ? value : undefined;
const jsonWithin = (value: unknown, maxBytes: number) => {
  try {
    return JSON.stringify(value).length <= maxBytes;
  } catch {
    return false;
  }
};

export const isVisitId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

/** Milliseconds to add to the client's clock to reach the server's. Small differences are noise from latency. */
export function clockOffsetMs(sentAt: unknown, now: number) {
  if (typeof sentAt !== "number" || !Number.isFinite(sentAt)) return 0;
  const offset = now - sentAt;
  return Math.abs(offset) < 2_000 ? 0 : offset;
}

/** A client epoch time as a server ISO timestamp, or undefined when it is implausible. */
export function toServerTime(clientMs: unknown, offsetMs: number, now: number) {
  if (typeof clientMs !== "number" || !Number.isFinite(clientMs)) return undefined;
  const time = clientMs + offsetMs;
  if (time > now + 5_000 || time < now - MAX_EVENT_AGE_MS) return undefined;
  return new Date(Math.min(time, now)).toISOString();
}

function sanitizeProperties(value: unknown) {
  const properties: Record<string, string | number | boolean | null> = {};
  if (!isRecord(value)) return properties;
  for (const [key, item] of Object.entries(value).slice(0, 24)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key)) continue;
    if (typeof item === "string") properties[key] = item.slice(0, 200);
    else if (typeof item === "number" && Number.isFinite(item)) properties[key] = item;
    else if (typeof item === "boolean" || item === null) properties[key] = item;
  }
  return properties;
}

export interface StoredEvent {
  name: string;
  step: string | null;
  occurred_at: string;
  duration_ms: number | null;
  properties: Record<string, string | number | boolean | null>;
}

export function sanitizeEvents(value: unknown, offsetMs: number, now: number): StoredEvent[] | null {
  if (!Array.isArray(value) || value.length > MAX_EVENTS_PER_BATCH) return null;
  return value.flatMap((raw: Partial<WireEvent>) => {
    if (!isRecord(raw)) return [];
    const name = text(raw.name, 64, /^[a-z][a-z0-9_]{1,63}$/);
    if (!name) return [];
    return [{
      name,
      step: text(raw.step, 80, /^\/[a-z0-9/_-]*$/) ?? null,
      occurred_at: toServerTime(raw.at, offsetMs, now) ?? new Date(now).toISOString(),
      duration_ms: int(raw.duration_ms, 0, 86_400_000) ?? null,
      properties: sanitizeProperties(raw.properties),
    }];
  });
}

export type StoredSnapshot = Omit<SessionSnapshot, "stage_times"> & { stage: number; stage_times: Record<string, string> };

/** The valuation snapshot as stored, or null when it does not describe a valuation. */
export function sanitizeSnapshot(value: unknown, offsetMs: number, now: number): StoredSnapshot | null {
  if (!isRecord(value)) return null;
  const clientSessionId = text(value.client_session_id, 80, /^[A-Za-z0-9._:-]+$/);
  const status = STATUSES.find((candidate) => candidate === value.status) as SessionSnapshot["status"] | undefined;
  const deviceId = text(value.device_id, 120);
  const category = DEVICE_CATEGORIES.find((candidate) => candidate === value.device_category);
  const brand = text(value.device_brand, 120);
  const model = text(value.device_model, 160);
  if (!clientSessionId || !status || !deviceId || !category || !brand || !model) return null;

  const specs: Record<string, string> = {};
  if (isRecord(value.device_specs)) {
    for (const [key, spec] of Object.entries(value.device_specs).slice(0, 12)) {
      if (/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(key) && typeof spec === "string" && spec.length <= 120) specs[key] = spec;
    }
  }
  const stageTimes: Record<string, string> = {};
  if (isRecord(value.stage_times)) {
    for (const { key } of STAGES) {
      const at = toServerTime(value.stage_times[key], offsetMs, now);
      if (at) stageTimes[key] = at;
    }
  }
  const answers = Array.isArray(value.assessment_answers) && value.assessment_answers.length <= 100 &&
    jsonWithin(value.assessment_answers, 24_000) ? value.assessment_answers : undefined;
  const deductions = Array.isArray(value.condition_deductions) && value.condition_deductions.length <= 16 &&
    jsonWithin(value.condition_deductions, 4_000) ? value.condition_deductions : undefined;
  const intent = value.transaction_intent === "outright_sale" || value.transaction_intent === "sell_and_repurchase"
    ? value.transaction_intent : undefined;

  return {
    client_session_id: clientSessionId,
    status,
    stage: Math.max(1, stageNumber(status)),
    device_id: deviceId,
    device_category: category,
    device_brand: brand,
    device_model: model,
    device_specs: specs,
    assessment_definition_id: text(value.assessment_definition_id, 120),
    assessment_version: int(value.assessment_version, 0, 1_000_000),
    assessment_answers: answers,
    condition_score: int(value.condition_score, 0, 100),
    condition_deductions: deductions,
    astly_job_id: text(value.astly_job_id, 64, /^[0-9a-f-]{16,64}$/i),
    estimated_price: int(value.estimated_price, 0, MAX_PRICE),
    market_price: int(value.market_price, 0, MAX_PRICE),
    pawn_price: int(value.pawn_price, 0, MAX_PRICE),
    expected_price: int(value.expected_price, 1, MAX_PRICE),
    transaction_intent: intent,
    stage_times: stageTimes,
  };
}

// Per-instance ceiling on stored events per LINE user. Serverless instances do
// not share it; it only stops one signed-in client from flooding the table.
const usage = new Map<string, { since: number; count: number }>();
export function allowEvents(userId: string, count: number, now: number, limit = 600, windowMs = 10 * 60 * 1000) {
  const entry = usage.get(userId);
  if (!entry || now - entry.since > windowMs) {
    if (usage.size > 10_000) usage.clear();
    usage.set(userId, { since: now, count });
    return count <= limit;
  }
  entry.count += count;
  return entry.count <= limit;
}
