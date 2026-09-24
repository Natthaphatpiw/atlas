import type { AssessmentDefinition } from "@/domain/assessment";
import type { CatalogDevice } from "@/domain/device-catalog";
import type { ConditionQuestion, Device, EstimatedPrice, PreliminaryValuation, ValuationSession } from "@/domain/types";

export type MockValuationResult = PreliminaryValuation;

export interface ValuationService {
  getDeviceCatalog(): Promise<CatalogDevice[]>;
  getDeviceAssessment(device: Device): Promise<AssessmentDefinition>;
  /** Legacy v1 fixture API; not used by the seller assessment. */
  getConditionQuestions(deviceCategory: Device["category"]): Promise<ConditionQuestion[]>;
  estimateValue(session: ValuationSession): Promise<EstimatedPrice>;
  getMockValuationResult(session: ValuationSession): Promise<MockValuationResult>;
}
