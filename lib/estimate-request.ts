import { getMockAssessment } from "@/adapters/mock/assessment";
import { deviceCatalog } from "@/data/devices";
import type { AssessmentAnswer, AssessmentDefinition } from "@/domain/assessment";
import type { AstlyEstimateInput } from "@/domain/astly";
import type { Device } from "@/domain/types";
import { assessmentComplete, isCurrentAssessment } from "@/lib/assessment";
import { toAstlyConditionChecks, toAstlyEstimateInput, UnsupportedDeviceError } from "@/lib/astly-estimate-input";
import { selectedDeviceSnapshot } from "@/lib/device-selection";

const MAX_ANSWERS = 100;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export interface ValuationSelection {
  device: Device;
  definition: AssessmentDefinition;
  answers: AssessmentAnswer[];
  /** Exactly what Astly prices for this device and assessment. */
  input: AstlyEstimateInput;
}

/**
 * Validates an EstimateRequestBody (lib/estimate-request-body.ts) and is the
 * server-side authority for what gets priced: the device must be a catalog
 * entry with catalog spec values, and the assessment must be complete for the
 * current definition. Browser-supplied scores or labels are never trusted.
 */
export function parseValuationSelection(raw: unknown): ValuationSelection | null {
  if (!isRecord(raw) || typeof raw.deviceId !== "string" || !isRecord(raw.specs) || !isRecord(raw.assessment)) return null;
  const catalogDevice = deviceCatalog.find((device) => device.id === raw.deviceId);
  if (!catalogDevice) return null;

  const selections: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw.specs)) {
    if (value === undefined) continue;
    const specKey = key as keyof Device["specs"];
    const options = catalogDevice.specOptions[specKey];
    const allowed = options ? options.some((option) => option.value === value) : catalogDevice.specs[specKey] === value;
    if (typeof value !== "string" || !allowed) return null;
    selections[key] = value;
  }
  const { brandId, releaseYear, sortOrder, specOptions, sources, ...catalogFields } = catalogDevice;
  void brandId; void releaseYear; void sortOrder; void specOptions; void sources;
  const device = selectedDeviceSnapshot(catalogFields, selections);

  const { definitionId, version, answers } = raw.assessment;
  if (!Array.isArray(answers) || answers.length > MAX_ANSWERS || typeof definitionId !== "string" || typeof version !== "number") return null;
  const definition = getMockAssessment(device);
  const assessment = { definitionId, version, source: "seller_reported" as const, answers: answers as AssessmentAnswer[] };
  if (!isCurrentAssessment(assessment, definition) || !assessmentComplete(definition, device, assessment.answers)) return null;

  try {
    const input = toAstlyEstimateInput(device, toAstlyConditionChecks(definition, device, assessment.answers));
    return { device, definition, answers: assessment.answers, input };
  } catch (error) {
    if (error instanceof UnsupportedDeviceError) return null;
    throw error;
  }
}

/** The Astly request for a validated EstimateRequestBody, or null when it is invalid. */
export function parseEstimateRequest(raw: unknown): AstlyEstimateInput | null {
  return parseValuationSelection(raw)?.input ?? null;
}
