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
  if (!stored) return null;
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

  if (!storedSession || !hasCompletedAssessment(storedSession)) {
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

  if (!storedSession || !hasCompletedAssessment(storedSession) || storedSession.session.id !== sessionId ||
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

  if (!storedSession || !hasCompletedAssessment(storedSession) || storedSession.session.id !== sessionId ||
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
  if (existing?.device && existing.session.deviceId === device.id &&
      hasSameDeviceConfiguration(existing.device, device)) {
    return existing;
  }
  const next = createDeviceSession(device);
  saveValuationSession(next);
  return next;
}
