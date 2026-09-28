// Server-only client for Astly's demo estimate API. Import it only from route
// handlers: it reads ASTLY_DEMO_API_KEY, which must never reach the browser.
import type {
  AstlyConditionAssessment,
  AstlyEstimateInput,
  AstlyEstimateJobStatus,
  AstlyEstimateResult,
  AstlyJobAccepted,
  EstimateApiError,
  EstimateJobState,
} from "@/domain/astly";
import { ASTLY_CONDITION_CHECK_KEYS } from "@/domain/astly";

const DEFAULT_BASE_URL = "https://www.astly.co";
const TIMEOUT_MS = 15_000;
const JOB_STATUSES: AstlyEstimateJobStatus[] = ["QUEUED", "PROCESSING", "RETRYING", "COMPLETED", "FAILED", "CANCELLED"];

export const estimateMessages = {
  unavailable: "ระบบประเมินราคาไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้ง",
  rateLimited: "คุณทดลองประเมินราคาครบตามจำนวนที่กำหนดแล้ว กรุณาลองใหม่ภายหลัง",
  unsupported: "ระบบยังประเมินราคาสินค้ารุ่นนี้ไม่ได้",
  jobNotFound: "ไม่พบรายการประเมินนี้ กรุณาเริ่มประเมินใหม่",
  invalidRequest: "ข้อมูลสินค้าหรือสภาพเครื่องไม่ครบถ้วน กรุณาตรวจสอบอีกครั้ง",
  failed: "ประเมินราคาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
};

export class AstlyApiError extends Error {
  constructor(readonly status: number, readonly body: EstimateApiError) {
    super(body.code);
    this.name = "AstlyApiError";
  }
}

const unavailable = () => new AstlyApiError(503, { code: "estimate_unavailable", error: estimateMessages.unavailable });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const text = (value: unknown, max = 400) => (typeof value === "string" ? value.slice(0, max) : "");

async function callAstly(path: string, visitor: string, body?: AstlyEstimateInput) {
  const key = process.env.ASTLY_DEMO_API_KEY?.trim();
  if (!key) {
    console.error("[astly] ASTLY_DEMO_API_KEY is not set; real estimates are disabled");
    throw new AstlyApiError(503, { code: "estimate_unconfigured", error: estimateMessages.unavailable });
  }
  const base = (process.env.ASTLY_API_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        authorization: `Bearer ${key}`,
        "x-demo-visitor": visitor,
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    console.error("[astly] request failed before a response", { path: path.replace(/[0-9a-f-]{16,}/gi, ":id") });
    throw unavailable();
  }
  const json: unknown = await response.json().catch(() => null);
  if (response.status === 401 || (response.status === 404 && !path.includes("/estimate/"))) {
    // The key was rejected or the demo API is switched off on Astly's side.
    console.error("[astly] demo API rejected Atlas", { status: response.status });
    throw new AstlyApiError(503, { code: "estimate_unconfigured", error: estimateMessages.unavailable });
  }
  return { status: response.status, headers: response.headers, json };
}

function retryAfter(headers: Headers, json: unknown): number | undefined {
  const fromBody = isRecord(json) && finite(json.retryAfterSeconds) ? json.retryAfterSeconds : undefined;
  const fromHeader = Number(headers.get("retry-after"));
  const seconds = fromBody ?? (Number.isFinite(fromHeader) && fromHeader > 0 ? fromHeader : undefined);
  return seconds === undefined ? undefined : Math.min(Math.max(Math.ceil(seconds), 1), 86_400);
}

function parseCondition(value: unknown): AstlyConditionAssessment | null {
  if (!isRecord(value) || !finite(value.score) || !Array.isArray(value.deductions)) return null;
  const deductions = value.deductions.flatMap((item) => {
    if (!isRecord(item) || !finite(item.deduction) || typeof item.label !== "string") return [];
    const key = ASTLY_CONDITION_CHECK_KEYS.find((candidate) => candidate === item.key);
    return key ? [{ key, label: text(item.label, 120), deduction: item.deduction }] : [];
  });
  return { score: value.score, deductions };
}

function parseResult(value: unknown): AstlyEstimateResult | null {
  if (!isRecord(value)) return null;
  const { estimatedPrice, marketPrice, pawnPrice, condition, confidence, loanToValue } = value;
  if (![estimatedPrice, marketPrice, pawnPrice, condition, confidence, loanToValue].every(finite)) return null;
  const calculation = isRecord(value.calculation) ? value.calculation : {};
  return {
    estimatedPrice: estimatedPrice as number,
    marketPrice: marketPrice as number,
    pawnPrice: pawnPrice as number,
    condition: condition as number,
    confidence: confidence as number,
    loanToValue: loanToValue as number,
    productName: text(value.productName, 200),
    calculation: {
      marketPrice: text(calculation.marketPrice),
      pawnPrice: text(calculation.pawnPrice),
      finalPrice: text(calculation.finalPrice),
    },
    completedAt: text(value.completedAt, 40) || new Date().toISOString(),
  };
}

function parseStatus(value: unknown): AstlyEstimateJobStatus | null {
  return JOB_STATUSES.find((status) => status === value) ?? null;
}

const pollAfter = (value: unknown) => (finite(value) ? Math.min(Math.max(value, 2_000), 15_000) : 4_000);

export async function createAstlyEstimate(input: AstlyEstimateInput, visitor: string): Promise<AstlyJobAccepted> {
  const { status, headers, json } = await callAstly("/api/demo/estimate", visitor, input);
  if (status === 429) {
    throw new AstlyApiError(429, { code: "rate_limited", error: estimateMessages.rateLimited, retryAfterSeconds: retryAfter(headers, json) });
  }
  if (status === 400) {
    throw new AstlyApiError(422, { code: "unsupported_device", error: estimateMessages.unsupported });
  }
  if (status !== 202 || !isRecord(json)) throw unavailable();
  const jobStatus = parseStatus(json.status);
  const condition = parseCondition(json.condition);
  if (typeof json.jobId !== "string" || !/^[0-9a-f-]{16,64}$/i.test(json.jobId) || !jobStatus || !condition) throw unavailable();
  return { jobId: json.jobId, status: jobStatus, pollAfterMs: pollAfter(json.pollAfterMs), condition };
}

export async function getAstlyEstimate(jobId: string, visitor: string): Promise<EstimateJobState> {
  const { status, json } = await callAstly(`/api/demo/estimate/${encodeURIComponent(jobId)}`, visitor);
  if (status === 404) throw new AstlyApiError(404, { code: "job_not_found", error: estimateMessages.jobNotFound });
  if (status !== 200 || !isRecord(json)) throw unavailable();
  const jobStatus = parseStatus(json.status);
  if (!jobStatus) throw unavailable();
  const state: EstimateJobState = { jobId, status: jobStatus, pollAfterMs: pollAfter(json.pollAfterMs) };
  if (typeof json.message === "string") state.message = text(json.message);
  if (jobStatus === "COMPLETED") {
    const result = parseResult(json.result);
    if (!result) throw unavailable();
    state.result = result;
  }
  if (jobStatus === "FAILED" || jobStatus === "CANCELLED") {
    state.error = text(json.error) || estimateMessages.failed;
    state.code = text(json.code, 80) || "estimate_failed";
  }
  return state;
}

/** Maps any estimate failure to Atlas's JSON error shape for the browser. */
export function astlyErrorResponse(error: unknown): Response {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (error instanceof AstlyApiError) {
    if (error.body.retryAfterSeconds) headers["Retry-After"] = String(error.body.retryAfterSeconds);
    return Response.json(error.body, { status: error.status, headers });
  }
  console.error("[astly] unexpected estimate failure");
  return Response.json({ code: "estimate_unavailable", error: estimateMessages.unavailable }, { status: 503, headers });
}
