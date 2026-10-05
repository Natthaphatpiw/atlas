import type { SessionStatus } from "@/domain/types";

// Shared by the LIFF tracker and Atlas's server: the valuation stages whose
// first-reached time is recorded, in flow order (database/atlas_liff.sql).
export const STAGES = [
  { key: "device_selected", status: "device_selected" },
  { key: "condition_completed", status: "condition_completed" },
  { key: "valued", status: "preliminary_valuation_available" },
  { key: "expected_price_entered", status: "expected_price_entered" },
  { key: "intent_selected", status: "transaction_intent_selected" },
  { key: "submitted", status: "request_submitted" },
] as const satisfies ReadonlyArray<{ key: string; status: SessionStatus }>;

export type StageKey = (typeof STAGES)[number]["key"];
export type StageTimes = Partial<Record<StageKey, number>>;

/** 1–6 for a current-flow status (see atlas_valuation_sessions.max_stage), else 0. */
export function stageNumber(status: unknown): number {
  return STAGES.findIndex((stage) => stage.status === status) + 1;
}

/** Wire shape of the valuation snapshot the LIFF app reports with its events. */
export interface SessionSnapshot {
  client_session_id: string;
  status: SessionStatus;
  device_id: string;
  device_category: string;
  device_brand: string;
  device_model: string;
  device_specs: Record<string, string>;
  assessment_definition_id?: string;
  assessment_version?: number;
  assessment_answers?: unknown[];
  condition_score?: number;
  condition_deductions?: unknown[];
  astly_job_id?: string;
  estimated_price?: number;
  market_price?: number;
  pawn_price?: number;
  expected_price?: number;
  transaction_intent?: string;
  /** Client epoch milliseconds at which each stage was first reached. */
  stage_times: StageTimes;
}

/** Wire shape of one tracked LIFF event. */
export interface WireEvent {
  name: string;
  step?: string;
  /** Client epoch milliseconds. */
  at: number;
  duration_ms?: number;
  properties?: Record<string, string | number | boolean | null>;
}
