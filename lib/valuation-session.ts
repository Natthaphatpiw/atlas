import type { MockRequestReceipt, RequestContext } from "@/domain/valuation-request";
import { getMockAssessment } from "@/adapters/mock/assessment";
import type { AssessmentAnswer, AssessmentDefinition } from "@/domain/assessment";
import { answerIdentity, assessmentComplete, isCurrentAssessment, pruneAnswers } from "@/lib/assessment";
import type { Device, ExpectedPrice, SessionStatus, ValuationSession } from "@/domain/types";

const storageKey = "atlast.valuation.session";

const sessionStages: SessionStatus[] = [
  "draft",
  "device_selected",
  "condition_completed",
  "expected_price_entered",
  "estimated",
  "lead_collected",
  "handoff_ready",
  "request_submitted",
];

export function hasReachedStage(status: SessionStatus | undefined, stage: SessionStatus) {
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
    return JSON.parse(rawSession) as StoredValuationSession;
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
  return isCurrentAssessment(assessment, definition) && Boolean(assessment.reviewedAt) &&
    assessmentComplete(definition, stored.device, assessment.answers) &&
    hasReachedStage(stored.session.status, "condition_completed");
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
    delete updated.session.expectedPrice;
    delete updated.session.estimatedPrice;
  }
  saveValuationSession(updated);
  return updated;
}

export function updateExpectedPrice(amount: number) {
  const storedSession = readValuationSession();

  if (!storedSession || storedSession.session.request || !hasCompletedAssessment(storedSession)) {
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

  saveValuationSession(updatedSession);
  return updatedSession;
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


export function hasRequestPrerequisites(stored: StoredValuationSession | null | undefined) {
  return hasCompletedAssessment(stored) && stored?.session.deviceId === stored?.device.id &&
    Number.isSafeInteger(stored?.session.expectedPrice?.amount) && (stored?.session.expectedPrice?.amount ?? 0) > 0 &&
    hasReachedStage(stored?.session.status, "expected_price_entered");
}

export function hasSubmittedRequest(stored: StoredValuationSession | null | undefined): boolean {
  const request = stored?.session?.request;
  return Boolean(stored && request && stored.session.status === "request_submitted" &&
    request.sessionId === stored.session.id && request.state === "submitted" &&
    request.lineConnection === "prototype_pending" && typeof request.id === "string" &&
    /^MOCK-[A-F0-9]{8}$/.test(request.reference) && typeof request.submittedAt === "string" &&
    request.context?.device && request.context?.assessment && request.context?.expectedPrice &&
    request.context?.preliminaryValuation && hasRequestPrerequisites(stored) &&
    requestContextMatches(stored, request.context));
}

function requestContextMatches(stored: StoredValuationSession, context: RequestContext) {
  const assessment = stored.session.assessment;
  if (!assessment || !context?.device?.specs || !context.expectedPrice || !context.preliminaryValuation) return false;
  const definition = getMockAssessment(stored.device);
  if (!isCurrentAssessment(context.assessment, definition) || !context.assessment.reviewedAt) return false;
  const range = context.preliminaryValuation;
  return hasSameDeviceConfiguration(stored.device, context.device) &&
    answerIdentity(assessment.answers) === answerIdentity(context.assessment.answers) &&
    stored.session.expectedPrice?.amount === context.expectedPrice.amount && context.expectedPrice.currency === "THB" &&
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
