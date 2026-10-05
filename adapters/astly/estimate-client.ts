import type { EstimateApiError, EstimateJobAccepted, EstimateJobState } from "@/domain/astly";
import type { EstimateRequestBody } from "@/lib/estimate-request-body";
import { liffAuthHeaders } from "@/lib/liff/auth";

// Browser client for Atlas's own estimate routes, which proxy Astly server-side.

export class EstimateRequestError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly retryAfterSeconds?: number) {
    super(message);
    this.name = "EstimateRequestError";
  }
}

const fallbackMessage = "ระบบประเมินราคาไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้ง";

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as (T & Partial<EstimateApiError>) | null;
  if (!response.ok || !body) {
    throw new EstimateRequestError(response.status, body?.code ?? "estimate_unavailable", body?.error ?? fallbackMessage, body?.retryAfterSeconds);
  }
  return body;
}

// One start per request key at a time: a remount (or React's development
// double effect) must not spend a second paid estimate from the visitor's quota.
const inFlightStarts = new Map<string, Promise<EstimateJobAccepted>>();

export function startEstimate(requestKey: string, body: EstimateRequestBody): Promise<EstimateJobAccepted> {
  const existing = inFlightStarts.get(requestKey);
  if (existing) return existing;
  const started = fetch("/api/valuation/estimate", {
    method: "POST",
    // In the LINE LIFF app, Astly meters the signed-in LINE user instead of the network.
    headers: { "content-type": "application/json", ...liffAuthHeaders() },
    body: JSON.stringify(body),
    cache: "no-store",
  })
    .catch(() => { throw new EstimateRequestError(0, "network_error", "เชื่อมต่อระบบไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่"); })
    .then((response) => readJson<EstimateJobAccepted>(response))
    .finally(() => inFlightStarts.delete(requestKey));
  inFlightStarts.set(requestKey, started);
  return started;
}

export async function fetchEstimate(jobId: string, ticket: string, signal?: AbortSignal): Promise<EstimateJobState> {
  let response: Response;
  try {
    response = await fetch(`/api/valuation/estimate/${encodeURIComponent(jobId)}`, {
      cache: "no-store",
      headers: { "x-estimate-ticket": ticket },
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new EstimateRequestError(0, "network_error", "เชื่อมต่อระบบไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
  }
  return readJson<EstimateJobState>(response);
}
