import type { AssessmentAnswer, AssessmentDefinition, AssessmentValue } from "@/domain/assessment";
import type { AstlyAppleCategory, AstlyConditionChecks, AstlyEstimateInput } from "@/domain/astly";
import type { Device } from "@/domain/types";
import { pruneAnswers } from "@/lib/assessment";

const damaged = ["minor", "noticeable", "severe"];
const clearlyDamaged = ["noticeable", "severe"];

// "Does it work?" questions answered "no", by the Astly checklist item they cost.
const failedDisplay = ["display_works", "display_has_no_defects", "built_in_display_works", "built_in_display_has_no_defects"];
const failedTouch = ["touchscreen_works", "stylus_works"];
const failedCamera = ["front_camera_works", "rear_camera_works", "cameras_work", "camera_works", "face_id_works"];
// Physical controls, ports, charging, audio and radios.
const failedPortOrButton = [
  "physical_buttons_work",
  "haptics_work",
  "wired_charging_works",
  "wireless_charging_works",
  "charging_port_works",
  "charging_works",
  "ports_work",
  "external_display_output_works",
  "keyboard_works",
  "trackpad_works",
  "touch_id_works",
  "speakers_work",
  "microphones_work",
  "wifi_works",
  "bluetooth_works",
  "cellular_works",
  "buttons_ports_work",
];

// Severity questions that only ask about damage, so any reported level counts.
// The others (iPhone back glass and frame, tablet back cover, Mac case and
// hinge) also cover cosmetic scratches or wear, so only clear damage counts.
const damageOnlyBody = ["exterior_condition", "frame_bending_condition", "chassis_bending_condition"];
const wearIncludedBody = ["back_glass_condition", "back_cover_condition", "case_body_condition", "hinge_condition", "keyboard_trackpad_condition"];

/**
 * Maps a seller-reported assessment onto Astly's eight-item checklist. Only
 * applicable, valid answers count, and "unknown" never deducts: the checklist
 * records reported faults, not missing information. Answers with no checklist
 * counterpart (scratches, repairs, accounts, accessories) do not move the price.
 */
export function toAstlyConditionChecks(definition: AssessmentDefinition, device: Device, answers: AssessmentAnswer[]): AstlyConditionChecks {
  const values = new Map<string, AssessmentValue>(
    pruneAnswers(definition, device, answers).map((answer) => [answer.questionId, answer.value]),
  );
  const choice = (questionId: string) => {
    const value = values.get(questionId);
    return value?.kind === "choice" ? value.optionId : undefined;
  };
  const is = (questionId: string, optionId: string) => choice(questionId) === optionId;
  const oneOf = (questionId: string, optionIds: string[]) => optionIds.includes(choice(questionId) ?? "");
  const anyNo = (questionIds: string[]) => questionIds.some((questionId) => is(questionId, "no"));
  const batteryHealth = values.get("battery_health_percentage");
  // The iPhone frame question includes scratches; the tablet one asks about damage only.
  const frameLevels = definition.coverage === "iphone" ? clearlyDamaged : damaged;

  return {
    screenCrack: oneOf("display_glass_condition", damaged),
    screenLineDeadPixel: anyNo(failedDisplay),
    touchIssue: anyNo(failedTouch),
    batteryIssue: is("battery_service_warning", "yes") || is("battery_degraded", "yes") || is("battery_holds_charge", "no") ||
      (batteryHealth?.kind === "number" && batteryHealth.value < 80),
    bodyDamage: damageOnlyBody.some((questionId) => oneOf(questionId, damaged)) ||
      wearIncludedBody.some((questionId) => oneOf(questionId, clearlyDamaged)) ||
      oneOf("frame_body_condition", frameLevels),
    cameraIssue: anyNo(failedCamera) || oneOf("camera_lens_condition", clearlyDamaged),
    portButtonIssue: anyNo(failedPortOrButton) || oneOf("ports_condition", clearlyDamaged),
    waterIssue: is("device_powers_on", "no") || is("severe_physical_or_liquid_damage", "yes") || is("power_stability", "no"),
  };
}

export class UnsupportedDeviceError extends Error {
  constructor(readonly deviceId: string) {
    super(`Astly estimate does not support ${deviceId}`);
    this.name = "UnsupportedDeviceError";
  }
}

const inches = (size: string | undefined) => (size && /^\d+(\.\d+)?$/.test(size) ? `${size}-inch` : size);
const specText = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" · ") || undefined;

function appleDesktopCategory(model: string): AstlyAppleCategory | null {
  if (/^iMac\b/i.test(model)) return "iMac";
  if (/^Mac mini\b/i.test(model)) return "Mac mini";
  if (/^Mac Studio\b/i.test(model)) return "Mac Studio";
  if (/^Mac Pro\b/i.test(model)) return "Mac Pro";
  return null;
}

/**
 * Builds the Astly request the same way Astly's own LINE estimate form describes an item.
 * Catalog variants are omitted: model names already carry the generation, and
 * a phone variant only repeats a storage size that can contradict the selected one.
 */
export function toAstlyEstimateInput(device: Device, conditionChecks: AstlyConditionChecks): AstlyEstimateInput {
  const { storage, ram, displaySize, chip, network } = device.specs;

  if (device.category === "phone") {
    if (device.brand === "Apple") {
      return { itemType: "Apple", appleCategory: "iPhone", brand: "Apple", model: device.model, capacity: storage, conditionChecks };
    }
    return { itemType: "โทรศัพท์มือถือ", brand: device.brand, model: device.model, capacity: storage, conditionChecks };
  }

  if (device.category === "tablet") {
    if (device.brand === "Apple") {
      // Astly's LINE form sends Apple specs as free text next to the model; cellular iPads price higher.
      const appleSpecs = specText(network, chip);
      return { itemType: "Apple", appleCategory: "iPad", brand: "Apple", model: device.model, capacity: storage, appleSpecs, conditionChecks };
    }
    return { itemType: "แท็บเล็ต", brand: device.brand, model: device.model, capacity: storage, conditionChecks };
  }

  if (device.category === "laptop" || device.category === "desktop") {
    const appleCategory = device.category === "laptop" ? "MacBook" : appleDesktopCategory(device.model);
    if (device.brand === "Apple" && appleCategory) {
      const appleSpecs = specText(chip, ram && `RAM ${ram}`, storage && `SSD ${storage}`, inches(displaySize));
      return { itemType: "Apple", appleCategory, brand: "Apple", model: device.model, capacity: storage, appleSpecs, conditionChecks };
    }
    if (device.category === "laptop") {
      return { itemType: "โน้ตบุค", brand: device.brand, model: device.model, cpu: chip, ram, storage, screenSize: inches(displaySize), conditionChecks };
    }
  }

  throw new UnsupportedDeviceError(device.id);
}
