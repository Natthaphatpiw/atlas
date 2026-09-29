import type { DeviceCategory } from "./types";

export type AssessmentFeature =
  | "face_id"
  | "touch_id"
  | "wireless_charging"
  | "cellular"
  | "stylus"
  | "built_in_display"
  | "built_in_camera"
  | "built_in_microphone"
  | "built_in_speakers";
export type AssessmentValue =
  | { kind: "choice"; optionId: string }
  | { kind: "multi"; optionIds: string[] }
  | { kind: "number"; value: number }
  | { kind: "unknown" }
  | { kind: "skipped" };

export interface AssessmentAnswer {
  questionId: string;
  value: AssessmentValue;
  answeredAt: string;
}

export interface AssessmentRule {
  questionId: string;
  operator: "equals" | "not_equals" | "includes";
  optionId: string;
}

interface QuestionBase {
  id: string;
  sectionId: string;
  groupId: string;
  label: string;
  help?: string;
  required: boolean;
  applicability?: { categories?: DeviceCategory[]; features?: AssessmentFeature[] };
  visibleWhen?: { all?: AssessmentRule[]; any?: AssessmentRule[] };
}

export type AssessmentQuestion = QuestionBase & (
  | { type: "single" | "yes_no_unknown"; options: { id: string; label: string }[] }
  | { type: "multi"; options: { id: string; label: string; exclusive?: boolean }[] }
  | { type: "number"; min: number; max: number; integer: boolean; allowUnknown: boolean; unit: string }
);

export interface AssessmentDefinition {
  id: string;
  version: number;
  coverage: "iphone" | "tablet" | "macbook" | "desktop" | "basic";
  features: AssessmentFeature[];
  sections: { id: string; label: string }[];
  // Dependencies must precede their dependent questions.
  questions: AssessmentQuestion[];
}

export interface SellerAssessment {
  definitionId: string;
  version: number;
  source: "seller_reported";
  answers: AssessmentAnswer[];
  reviewedAt?: string;
}
