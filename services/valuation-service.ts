import type { ConditionQuestion, Device, EstimatedPrice, ValuationSession } from "@/domain/types";

export interface ValuationService {
  getDeviceCatalog(): Promise<Device[]>;
  getConditionQuestions(deviceCategory: Device["category"]): Promise<ConditionQuestion[]>;
  estimateValue(session: ValuationSession): Promise<EstimatedPrice>;
}
