import type { MockRequestReceipt, RequestReceiptContext } from "@/domain/valuation-request";
import type { AstlyValuation, EstimateJobAccepted } from "@/domain/astly";
import { toAstlyConditionChecks, toAstlyEstimateInput } from "@/lib/astly-estimate-input";
import { getMockAssessment } from "@/adapters/mock/assessment";
import type { AssessmentAnswer, AssessmentDefinition } from "@/domain/assessment";
import { answerIdentity, assessmentComplete, isCurrentAssessment, pruneAnswers } from "@/lib/assessment";
import type { Device, ExpectedPrice, PreliminaryValuation, SessionStatus, TransactionIntent, ValuationSession } from "@/domain/types";

const storageKey = "atlast.valuation.session";

const sessionStages: SessionStatus[] = [
  "draft",
  "device_selected",
  "condition_completed",
  "preliminary_valuation_available",
  "expected_price_entered",
  "transaction_intent_selected",
  "request_submitted",
];

export function hasReachedStage(status: SessionStatus | undefined, stage: SessionStatus) {
  const legacyStages: SessionStatus[] = ["estimated", "lead_collected", "handoff_ready"];
  if (legacyStages.includes(status as SessionStatus) || legacyStages.includes(stage)) {
    return status !== undefined && legacyStages.includes(status) && legacyStages.includes(stage) &&
      legacyStages.indexOf(status) >= legacyStages.indexOf(stage);
  }
  return status !== undefined && sessionStages.indexOf(status) >= sessionStages.indexOf(stage);
}

export interface StoredValuationSession {
  session: ValuationSession;
  device: Device;
}

export function createDeviceSession(device: Device): StoredValuationSession {
  const now = new Date().toISOString();

  return {
    device,
    session: {
      id: `session-${Date.now()}`,
      status: "device_selected",
      deviceId: device.id,
      conditionAnswers: [],
      createdAt: now,
      updatedAt: now,
    },
  };
}

export function saveValuationSession(storedSession: StoredValuationSession) {
  if (typeof window !== "undefined") {
    if (readValuationSession()?.session?.request) throw new Error("Submitted request cannot be edited");
    window.sessionStorage.setItem(storageKey, JSON.stringify(storedSession));
  }
}

export function readValuationSession(): StoredValuationSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSession = window.sessionStorage.getItem(storageKey);

  if (!rawSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSession) as StoredValuationSession;
    const receiptAssessment = parsed.session?.request?.context?.assessment as
      (RequestReceiptContext["assessment"] & { answers?: unknown }) | undefined;
    if (receiptAssessment && "answers" in receiptAssessment) {
      const safeAssessment = { ...receiptAssessment };
      delete safeAssessment.answers;
      parsed.session.request!.context.assessment = safeAssessment;
      window.sessionStorage.setItem(storageKey, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    window.sessionStorage.removeItem(storageKey);
    return null;
  }
}

// The fixture definition is the current frontend authority, not a backend contract.
export function hasCompletedAssessment(stored: StoredValuationSession | null | undefined) {
  if (!stored?.device || !stored.session) return false;
  const definition = getMockAssessment(stored.device);
  const assessment = stored.session.assessment;
  const legacyCompletedStatus = stored.session.status === "estimated" ||
    stored.session.status === "lead_collected" || stored.session.status === "handoff_ready";
  return isCurrentAssessment(assessment, definition) && Boolean(assessment.reviewedAt) &&
    assessmentComplete(definition, stored.device, assessment.answers) &&
    (hasReachedStage(stored.session.status, "condition_completed") || legacyCompletedStatus);
}

export function saveAssessmentAnswers(definition: AssessmentDefinition, answers: AssessmentAnswer[], reviewed = false) {
  const stored = readValuationSession();
  if (!stored || stored.session.request) return null;
  const currentDefinition = getMockAssessment(stored.device);
  if (currentDefinition.id !== definition.id || currentDefinition.version !== definition.version) return null;
  const clean = pruneAnswers(currentDefinition, stored.device, answers);
  const previous = stored.session.assessment;
  const unchanged = isCurrentAssessment(previous, currentDefinition) &&
    answerIdentity(previous.answers) === answerIdentity(clean);
  const now = new Date().toISOString();
  const reviewedAt = reviewed && assessmentComplete(currentDefinition, stored.device, clean)
    ? (unchanged && previous?.reviewedAt ? previous.reviewedAt : now)
    : unchanged ? previous?.reviewedAt : undefined;
  const updated: StoredValuationSession = {
    ...stored,
    session: {
      ...stored.session,
      assessment: { definitionId: currentDefinition.id, version: currentDefinition.version,
        source: "seller_reported", answers: clean, ...(reviewedAt ? { reviewedAt } : {}) },
      status: unchanged && reviewedAt && hasReachedStage(stored.session.status, "condition_completed")
        ? stored.session.status : reviewedAt ? "condition_completed" : "device_selected",
      updatedAt: now,
    },
  };
  if (!unchanged) {
    // An Astly valuation or job survives edits that do not change what Astly prices.
    const pricedKey = estimateRequestKey(updated);
    if (updated.session.preliminaryValuation?.astly?.requestKey !== pricedKey) delete updated.session.preliminaryValuation;
    if (updated.session.estimateJob?.requestKey !== pricedKey) delete updated.session.estimateJob;
    delete updated.session.expectedPrice;
    delete updated.session.transactionIntent;
    delete updated.session.estimatedPrice;
  }
  saveValuationSession(updated);
  return updated;
}

export function markPreliminaryValuationAvailable(preliminaryValuation: PreliminaryValuation) {
  const stored = readValuationSession();
  if (!stored || stored.session.request || !hasCompletedAssessment(stored) ||
      preliminaryValuation.currency !== "THB" || !Number.isFinite(preliminaryValuation.minPrice) ||
      !Number.isFinite(preliminaryValuation.maxPrice) || preliminaryValuation.minPrice > preliminaryValuation.maxPrice) {
    return null;
  }

  const existing = stored.session.preliminaryValuation;
  if (existing?.currency === preliminaryValuation.currency && existing.minPrice === preliminaryValuation.minPrice &&
      existing.maxPrice === preliminaryValuation.maxPrice && existing.source === preliminaryValuation.source &&
      existing.astly?.requestKey === preliminaryValuation.astly?.requestKey &&
      hasReachedStage(stored.session.status, "preliminary_valuation_available")) {
    return stored;
  }

  const updated: StoredValuationSession = {
    ...stored,
    session: {
      ...stored.session,
      status: "preliminary_valuation_available",
      preliminaryValuation,
      updatedAt: new Date().toISOString(),
    },
  };
  delete updated.session.transactionIntent;
  delete updated.session.estimateJob;
  saveValuationSession(updated);
  return updated;
}

// Astly keeps a job for two hours; resume only well inside that window.
const ESTIMATE_JOB_RESUME_MS = 90 * 60 * 1000;

/**
 * Identity of what an Astly estimate prices: exactly the request Astly
 * receives. Answers Astly never sees (Find My, scratches, repairs...) do not
 * change it, so editing them keeps the valuation instead of paying again.
 */
export function estimateRequestKey(stored: StoredValuationSession): string | null {
  const assessment = stored.session.assessment;
  if (!assessment) return null;
  try {
    const definition = getMockAssessment(stored.device);
    return JSON.stringify(toAstlyEstimateInput(stored.device, toAstlyConditionChecks(definition, stored.device, assessment.answers)));
  } catch {
    return null;
  }
}

/** The Astly valuation on the session, if it still prices the current device and assessment. */
export function currentAstlyValuation(stored: StoredValuationSession | null | undefined): AstlyValuation | null {
  const valuation = stored?.session.preliminaryValuation;
  if (!stored || !hasCompletedAssessment(stored) || valuation?.source !== "astly" || !valuation.astly ||
      valuation.currency !== "THB" || !Number.isFinite(valuation.minPrice) || valuation.minPrice !== valuation.maxPrice) return null;
  return valuation.astly.requestKey === estimateRequestKey(stored) ? valuation.astly : null;
}

export function currentEstimateJob(stored: StoredValuationSession | null | undefined, now = Date.now()) {
  const job = stored?.session.estimateJob;
  if (!stored || !job || job.requestKey !== estimateRequestKey(stored)) return null;
  const age = now - Date.parse(job.startedAt);
  return Number.isFinite(age) && age >= 0 && age < ESTIMATE_JOB_RESUME_MS ? job : null;
}

/** Saves a started job, but only while the session still prices what it was started for. */
export function saveEstimateJob(job: EstimateJobAccepted, requestKey: string) {
  const stored = readValuationSession();
  if (!stored || stored.session.request || !hasCompletedAssessment(stored) || estimateRequestKey(stored) !== requestKey) return null;
  const updated: StoredValuationSession = {
    ...stored,
    session: {
      ...stored.session,
      estimateJob: { jobId: job.jobId, ticket: job.ticket, requestKey, condition: job.condition, startedAt: new Date().toISOString() },
      updatedAt: new Date().toISOString(),
    },
  };
  saveValuationSession(updated);
  return updated;
}

export function clearEstimateJob() {
  const stored = readValuationSession();
  if (!stored || stored.session.request || !stored.session.estimateJob) return;
  const updated: StoredValuationSession = { ...stored, session: { ...stored.session, updatedAt: new Date().toISOString() } };
  delete updated.session.estimateJob;
  saveValuationSession(updated);
}

export function hasPreliminaryValuation(stored: StoredValuationSession | null | undefined) {
  const valuation = stored?.session.preliminaryValuation;
  return hasCompletedAssessment(stored) && Boolean(valuation && valuation.currency === "THB" &&
    Number.isFinite(valuation.minPrice) && Number.isFinite(valuation.maxPrice) && valuation.minPrice <= valuation.maxPrice) &&
    hasReachedStage(stored?.session.status, "preliminary_valuation_available");
}

export function updateExpectedPrice(amount: number) {
  const storedSession = readValuationSession();

  if (!storedSession || storedSession.session.request || !hasPreliminaryValuation(storedSession)) {
    return null;
  }

  // Revisiting a completed step without changing its value preserves later progress.
  if (storedSession.session.expectedPrice?.amount === amount &&
      hasReachedStage(storedSession.session.status, "expected_price_entered")) {
    return storedSession;
  }

  const expectedPrice: ExpectedPrice = {
    amount,
    currency: "THB",
    enteredBy: "seller",
    source: "manual_entry",
    createdAt: new Date().toISOString(),
  };

  const updatedSession: StoredValuationSession = {
    ...storedSession,
    session: {
      ...storedSession.session,
      status: "expected_price_entered",
      expectedPrice,
      updatedAt: new Date().toISOString(),
    },
  };
  delete updatedSession.session.transactionIntent;

  saveValuationSession(updatedSession);
  return updatedSession;
}

export function updateTransactionIntent(transactionIntent: TransactionIntent) {
  const stored = readValuationSession();
  if (!stored || stored.session.request || !hasPreliminaryValuation(stored) ||
      !Number.isSafeInteger(stored.session.expectedPrice?.amount) || (stored.session.expectedPrice?.amount ?? 0) <= 0 ||
      !hasReachedStage(stored.session.status, "expected_price_entered") ||
      !["outright_sale", "sell_and_repurchase"].includes(transactionIntent)) return null;

  if (stored.session.transactionIntent === transactionIntent &&
      hasReachedStage(stored.session.status, "transaction_intent_selected")) return stored;

  const updated: StoredValuationSession = {
    ...stored,
    session: {
      ...stored.session,
      status: "transaction_intent_selected",
      transactionIntent,
      updatedAt: new Date().toISOString(),
    },
  };
  saveValuationSession(updated);
  return updated;
}

export function markLeadCollected(sessionId: string) {
  const storedSession = readValuationSession();

  if (!storedSession || storedSession.session.request || !hasCompletedAssessment(storedSession) || storedSession.session.id !== sessionId ||
      !hasReachedStage(storedSession.session.status, "expected_price_entered")) {
    return null;
  }

  const updatedSession: StoredValuationSession = {
    ...storedSession,
    session: {
      ...storedSession.session,
      status: hasReachedStage(storedSession.session.status, "lead_collected")
        ? storedSession.session.status
        : "lead_collected",
      updatedAt: new Date().toISOString(),
    },
  };

  saveValuationSession(updatedSession);
  return updatedSession;
}

// Ready means the frontend continuation screen is prepared, not that LINE is connected.
export function markHandoffReady(sessionId: string) {
  const storedSession = readValuationSession();

  if (!storedSession || storedSession.session.request || !hasCompletedAssessment(storedSession) || storedSession.session.id !== sessionId ||
      !hasReachedStage(storedSession.session.status, "lead_collected")) {
    return null;
  }

  if (hasReachedStage(storedSession.session.status, "handoff_ready")) {
    return storedSession;
  }

  const updatedSession: StoredValuationSession = {
    ...storedSession,
    session: {
      ...storedSession.session,
      status: "handoff_ready",
      updatedAt: new Date().toISOString(),
    },
  };

  saveValuationSession(updatedSession);
  return updatedSession;
}

// Device IDs identify catalog entries; structured specs identify their configuration.
export function hasSameDeviceConfiguration(left: Device, right: Device) {
  const keys = new Set([...Object.keys(left.specs), ...Object.keys(right.specs)]);
  return left.id === right.id && [...keys].every((key) =>
    left.specs[key as keyof Device["specs"]] === right.specs[key as keyof Device["specs"]],
  );
}

export function continueWithDevice(device: Device) {
  const existing = readValuationSession();
  if (existing?.session?.request) return existing;
  if (existing?.device && existing.session.deviceId === device.id &&
      hasSameDeviceConfiguration(existing.device, device)) {
    return existing;
  }
  const next = createDeviceSession(device);
  saveValuationSession(next);
  return next;
}

// An explicit post-submission action starts a fresh local valuation lifecycle.
// It intentionally removes only Atlas's current browser-session snapshot.
export function startNewValuation() {
  if (typeof window === "undefined") return false;
  window.sessionStorage.removeItem(storageKey);
  return true;
}


export function hasRequestPrerequisites(stored: StoredValuationSession | null | undefined) {
  return hasPreliminaryValuation(stored) && stored?.session.deviceId === stored?.device.id &&
    Number.isSafeInteger(stored?.session.expectedPrice?.amount) && (stored?.session.expectedPrice?.amount ?? 0) > 0 &&
    (stored?.session.transactionIntent === "outright_sale" || stored?.session.transactionIntent === "sell_and_repurchase") &&
    hasReachedStage(stored?.session.status, "transaction_intent_selected");
}

export function hasSubmittedRequest(stored: StoredValuationSession | null | undefined): boolean {
  const request = stored?.session?.request;
  return Boolean(stored && request && stored.session.status === "request_submitted" &&
    request.sessionId === stored.session.id && request.state === "submitted" &&
    request.lineConnection === "prototype_pending" && typeof request.id === "string" &&
    /^MOCK-[A-F0-9]{8}$/.test(request.reference) && typeof request.submittedAt === "string" &&
    request.context?.device && request.context?.assessment && request.context?.expectedPrice && request.context?.transactionIntent &&
    request.context?.preliminaryValuation && hasRequestPrerequisites(stored) &&
    requestContextMatches(stored, request.context));
}

function requestContextMatches(stored: StoredValuationSession, context: RequestReceiptContext) {
  const assessment = stored.session.assessment;
  if (!assessment || !context?.device?.specs || !context.expectedPrice || !context.preliminaryValuation || !context.transactionIntent) return false;
  const range = context.preliminaryValuation;
  return hasSameDeviceConfiguration(stored.device, context.device) &&
    assessment.definitionId === context.assessment?.definitionId &&
    assessment.version === context.assessment?.version &&
    assessment.reviewedAt === context.assessment?.reviewedAt &&
    stored.session.preliminaryValuation?.minPrice === range.minPrice &&
    stored.session.preliminaryValuation?.maxPrice === range.maxPrice &&
    stored.session.preliminaryValuation?.currency === range.currency &&
    stored.session.expectedPrice?.amount === context.expectedPrice.amount && context.expectedPrice.currency === "THB" &&
    stored.session.transactionIntent === context.transactionIntent &&
    range.currency === "THB" && Number.isFinite(range.minPrice) && Number.isFinite(range.maxPrice) &&
    range.minPrice <= range.maxPrice;
}

export function markRequestSubmitted(request: MockRequestReceipt) {
  const stored = readValuationSession();
  if (!stored || !hasRequestPrerequisites(stored)) return null;
  if (stored.session.request) return hasSubmittedRequest(stored) ? stored : null;
  if (request.sessionId !== stored.session.id || request.state !== "submitted" ||
      request.lineConnection !== "prototype_pending" || !requestContextMatches(stored, request.context)) return null;
  const updated: StoredValuationSession = {
    ...stored,
    session: { ...stored.session, status: "request_submitted", request, updatedAt: new Date().toISOString() },
  };
  if (!hasSubmittedRequest(updated)) return null;
  saveValuationSession(updated);
  return updated;
}
