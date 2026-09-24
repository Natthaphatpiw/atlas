import type { MockRequestReceipt } from "./valuation-request";
import type { SellerAssessment } from "./assessment";

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
  | "preliminary_valuation_available"
  | "expected_price_entered"
  | "transaction_intent_selected"
  /** Legacy statuses retained only for recovery from earlier browser sessions. */
  | "estimated"
  | "lead_collected"
  | "handoff_ready"
  | "request_submitted";

export type TransactionIntent = "outright_sale" | "sell_and_repurchase";

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

export interface PreliminaryValuation {
  minPrice: number;
  maxPrice: number;
  currency: CurrencyCode;
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
  /** Legacy v1 snapshots, retained only for recovery; never scored for v2. */
  conditionAnswers: ConditionAnswer[];
  assessment?: SellerAssessment;
  request?: MockRequestReceipt;
  preliminaryValuation?: PreliminaryValuation;
  expectedPrice?: ExpectedPrice;
  transactionIntent?: TransactionIntent;
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
  transactionIntent?: TransactionIntent;
  questionId?: string;
  assessmentVersion?: number;
}

export type AnalyticsEventName =
  | "landing_viewed"
  | "valuation_started"
  | "device_selected"
  | "condition_question_answered"
  | "condition_section_completed"
  | "expected_price_entered"
  | "transaction_intent_selected"
  | "valuation_calculated"
  | "valuation_result_viewed"
  | "seller_proceeded"
  | "seller_declined"
  | "seller_contact_viewed"
  | "valuation_request_submitted"
  | "line_connect_viewed"
  | "line_connect_started"
  | "lead_submitted"
  | "handoff_started"
  | "handoff_completed"
  | "line_redirect_clicked";
