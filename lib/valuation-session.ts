import type { ConditionAnswer, Device, ExpectedPrice, SessionStatus, ValuationSession } from "@/domain/types";

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

export function updateConditionAnswers(
  conditionAnswers: ConditionAnswer[],
  status: SessionStatus = "condition_completed",
) {
  const storedSession = readValuationSession();

  if (!storedSession) {
    return null;
  }

  const updatedSession: StoredValuationSession = {
    ...storedSession,
    session: {
      ...storedSession.session,
      status:
        JSON.stringify(storedSession.session.conditionAnswers) === JSON.stringify(conditionAnswers) &&
        hasReachedStage(storedSession.session.status, status)
          ? storedSession.session.status
          : status,
      conditionAnswers,
      updatedAt: new Date().toISOString(),
    },
  };

  saveValuationSession(updatedSession);
  return updatedSession;
}

export function updateExpectedPrice(amount: number) {
  const storedSession = readValuationSession();

  if (!storedSession) {
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

  if (!storedSession || storedSession.session.id !== sessionId ||
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
