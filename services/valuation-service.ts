import type { AssessmentDefinition } from "@/domain/assessment";
import type { ConditionQuestion, CurrencyCode, Device, EstimatedPrice, ValuationSession } from "@/domain/types";

export interface MockValuationResult {
  minPrice: number;
  maxPrice: number;
  currency: CurrencyCode;
}

export interface ValuationService {
  getDeviceCatalog(): Promise<Device[]>;
  getDeviceAssessment(device: Device): Promise<AssessmentDefinition>;
  /** Legacy v1 fixture API; not used by the seller assessment. */
  getConditionQuestions(deviceCategory: Device["category"]): Promise<ConditionQuestion[]>;
  estimateValue(session: ValuationSession): Promise<EstimatedPrice>;
  getMockValuationResult(session: ValuationSession): Promise<MockValuationResult>;
}
