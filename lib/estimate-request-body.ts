import type { AssessmentAnswer, SellerAssessment } from "@/domain/assessment";
import type { Device } from "@/domain/types";

/** Body the browser sends to Atlas's POST /api/valuation/estimate. */
export interface EstimateRequestBody {
  deviceId: string;
  specs: Device["specs"];
  assessment: { definitionId: string; version: number; answers: AssessmentAnswer[] };
}

export function estimateRequestBody(device: Device, assessment: SellerAssessment): EstimateRequestBody {
  return {
    deviceId: device.id,
    specs: device.specs,
    assessment: { definitionId: assessment.definitionId, version: assessment.version, answers: assessment.answers },
  };
}
