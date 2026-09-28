// Contract for Astly's demo estimate API (https://www.astly.co/api/demo/estimate).
// Atlas reaches it only through its own server routes; the browser never sees
// the Astly API key or calls astly.co directly.

/** Astly's seller condition checklist, the same one its LINE estimate flow uses. */
export const ASTLY_CONDITION_CHECK_KEYS = [
  "screenCrack",
  "screenLineDeadPixel",
  "touchIssue",
  "batteryIssue",
  "bodyDamage",
  "cameraIssue",
  "portButtonIssue",
  "waterIssue",
] as const;

export type AstlyConditionCheckKey = (typeof ASTLY_CONDITION_CHECK_KEYS)[number];
export type AstlyConditionChecks = Record<AstlyConditionCheckKey, boolean>;

export type AstlyItemType = "Apple" | "โทรศัพท์มือถือ" | "แท็บเล็ต" | "โน้ตบุค";
export type AstlyAppleCategory = "iPhone" | "iPad" | "MacBook";

/** Body Atlas sends to POST /api/demo/estimate. Color is omitted on purpose: it does not move price and would split Astly's cache. */
export interface AstlyEstimateInput {
  itemType: AstlyItemType;
  brand: string;
  model: string;
  appleCategory?: AstlyAppleCategory;
  capacity?: string;
  appleSpecs?: string;
  ram?: string;
  storage?: string;
  cpu?: string;
  screenSize?: string;
  conditionChecks: AstlyConditionChecks;
}

export interface AstlyConditionDeduction {
  key: AstlyConditionCheckKey;
  label: string;
  deduction: number;
}

/** Astly's checklist score, returned when a job is accepted. */
export interface AstlyConditionAssessment {
  score: number;
  deductions: AstlyConditionDeduction[];
}

export type AstlyEstimateJobStatus = "QUEUED" | "PROCESSING" | "RETRYING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface AstlyEstimateResult {
  estimatedPrice: number;
  marketPrice: number;
  pawnPrice: number;
  /** Condition multiplier applied by Astly, 0–1. */
  condition: number;
  confidence: number;
  loanToValue: number;
  productName: string;
  calculation: { marketPrice: string; pawnPrice: string; finalPrice: string };
  completedAt: string;
}

/** Astly's reply to starting an estimate. */
export interface AstlyJobAccepted {
  jobId: string;
  status: AstlyEstimateJobStatus;
  pollAfterMs: number;
  condition: AstlyConditionAssessment;
}

/** What Atlas's own POST /api/valuation/estimate returns to the browser. */
export interface EstimateJobAccepted extends AstlyJobAccepted {
  /** Signed proof of ownership; send it back as X-Estimate-Ticket when polling. */
  ticket: string;
}

/** What Atlas's own GET /api/valuation/estimate/[jobId] returns to the browser. */
export interface EstimateJobState {
  jobId: string;
  status: AstlyEstimateJobStatus;
  pollAfterMs: number;
  message?: string;
  result?: AstlyEstimateResult;
  error?: string;
  code?: string;
}

export interface EstimateApiError {
  error: string;
  code: string;
  retryAfterSeconds?: number;
}

/** An Astly estimate saved on the session's preliminary valuation. */
export interface AstlyValuation {
  jobId: string;
  /** Identity of the device configuration and assessment answers it priced. */
  requestKey: string;
  condition: AstlyConditionAssessment;
  result: AstlyEstimateResult;
}

/** A started Astly job, kept so a reload resumes polling instead of paying for a new estimate. */
export interface PendingEstimateJob {
  jobId: string;
  ticket: string;
  requestKey: string;
  condition: AstlyConditionAssessment;
  startedAt: string;
}
