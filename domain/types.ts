export type CurrencyCode = "THB";

export type DeviceCategory =
  | "phone"
  | "tablet"
  | "laptop"
  | "watch"
  | "audio"
  | "other";

export type SessionStatus =
  | "draft"
  | "device_selected"
  | "condition_completed"
  | "expected_price_entered"
  | "estimated"
  | "lead_collected"
  | "handoff_ready";

export type ConditionScore = "excellent" | "good" | "fair" | "poor";

export interface Device {
  id: string;
  category: DeviceCategory;
  brand: string;
  model: string;
  variant?: string;
  specs: {
    storage?: string;
    color?: string;
    network?: string;
    ram?: string;
    displaySize?: string;
  };
  marketHints?: string[];
  createdAt: string;
}

export interface ConditionQuestion {
  id: string;
  category: DeviceCategory;
  prompt: string;
  title?: string;
  topic?: "exterior" | "display" | "functional" | "battery" | "device_specific";
  description?: string;
  answerType?: "single-choice";
  required?: boolean;
  applicableCategories?: DeviceCategory[];
  analyticsId?: string;
  weight: number;
  options: Array<{
    label: string;
    value: string;
    normalizedScore: number;
  }>;
}

export interface ConditionAnswer {
  questionId: string;
  questionText: string;
  answer: string;
  normalizedScore: number;
  weight: number;
  answeredAt: string;
}

export interface ExpectedPrice {
  amount: number;
  currency: CurrencyCode;
  enteredBy: "seller";
  source: "manual_entry";
  createdAt: string;
}

export interface EstimatedPrice {
  amount: number;
  currency: CurrencyCode;
  confidence: number;
  rangeMin: number;
  rangeMax: number;
  formulaVersion: string;
  breakdown: {
    baseValue: number;
    conditionAdjustment: number;
    marketAdjustment: number;
  };
  generatedAt: string;
}

export interface ValuationSession {
  id: string;
  status: SessionStatus;
  deviceId?: string;
  conditionAnswers: ConditionAnswer[];
  expectedPrice?: ExpectedPrice;
  estimatedPrice?: EstimatedPrice;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  sessionId: string;
  fullName: string;
  phone: string;
  email?: string;
  consentToContact: boolean;
  source: "atlast_web";
  createdAt: string;
}

export interface Handoff {
  id: string;
  sessionId: string;
  destination: "line_official_account";
  destinationUrl: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AnalyticsEvent {
  eventName: AnalyticsEventName;
  sessionId?: string;
  route?: string;
  deviceCategory?: DeviceCategory;
  deviceId?: string;
  estimatedAmount?: number;
  expectedAmount?: number;
  confidence?: number;
  timestamp: string;
  sourceChannel?: string;
}

export type AnalyticsEventName =
  | "landing_viewed"
  | "valuation_started"
  | "device_selected"
  | "condition_question_answered"
  | "condition_section_completed"
  | "expected_price_entered"
  | "valuation_calculated"
  | "valuation_result_viewed"
  | "seller_proceeded"
  | "seller_declined"
  | "lead_submitted"
  | "handoff_started"
  | "handoff_completed"
  | "line_redirect_clicked";
