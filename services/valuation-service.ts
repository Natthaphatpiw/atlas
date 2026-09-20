import type { ConditionQuestion, CurrencyCode, Device, EstimatedPrice, ValuationSession } from "@/domain/types";

export interface MockValuationResult {
  minPrice: number;
  maxPrice: number;
  currency: CurrencyCode;
}

export interface ValuationService {
  getDeviceCatalog(): Promise<Device[]>;
  getConditionQuestions(deviceCategory: Device["category"]): Promise<ConditionQuestion[]>;
  estimateValue(session: ValuationSession): Promise<EstimatedPrice>;
  getMockValuationResult(session: ValuationSession): Promise<MockValuationResult>;
}
