import type { AssessmentAnswer, AssessmentDefinition, AssessmentValue } from "@/domain/assessment";
import type { AstlyConditionChecks, AstlyEstimateInput } from "@/domain/astly";
import type { Device } from "@/domain/types";
import { pruneAnswers } from "@/lib/assessment";

const damaged = ["minor", "noticeable", "severe"];
const clearlyDamaged = ["noticeable", "severe"];

// Every function question whose failure Astly prices as a port/button fault.
const portButtonQuestions = [
  "physical_buttons_work",
  "haptics_work",
  "wired_charging_works",
  "wireless_charging_works",
  "touch_id_works",
  "speakers_work",
  "microphones_work",
  "wifi_works",
  "bluetooth_works",
  "cellular_works",
  "buttons_ports_work",
];

/**
 * Maps a seller-reported assessment onto Astly's eight-item checklist. Only
 * applicable, valid answers count, and "unknown" never deducts: the checklist
 * records reported faults, not missing information.
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
  const batteryHealth = values.get("battery_health_percentage");

  return {
    screenCrack: oneOf("display_glass_condition", damaged),
    screenLineDeadPixel: is("display_works", "no"),
    touchIssue: is("touchscreen_works", "no"),
    batteryIssue: is("battery_service_warning", "yes") || is("battery_degraded", "yes") ||
      (batteryHealth?.kind === "number" && batteryHealth.value < 80),
    // iPhone body questions include cosmetic scratches, so only clear damage
    // counts; the basic question asks about dents, cracks and damage only.
    bodyDamage: oneOf("back_glass_condition", clearlyDamaged) || oneOf("frame_body_condition", clearlyDamaged) ||
      oneOf("exterior_condition", damaged),
    cameraIssue: is("front_camera_works", "no") || is("rear_camera_works", "no") || is("cameras_work", "no") ||
      is("face_id_works", "no") || oneOf("camera_lens_condition", clearlyDamaged),
    portButtonIssue: portButtonQuestions.some((questionId) => is(questionId, "no")),
    waterIssue: is("device_powers_on", "no") || is("severe_physical_or_liquid_damage", "yes"),
  };
}

export class UnsupportedDeviceError extends Error {
  constructor(readonly deviceId: string) {
    super(`Astly estimate does not support ${deviceId}`);
    this.name = "UnsupportedDeviceError";
  }
}

const joined = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(" ").trim();

/**
 * Builds the Astly request the same way Astly's own LINE estimate form describes an item.
 * Phone and tablet variants are omitted: in this catalog they only repeat a
 * storage size, which would contradict the capacity the seller selected.
 */
export function toAstlyEstimateInput(device: Device, conditionChecks: AstlyConditionChecks): AstlyEstimateInput {
  const { storage, ram, displaySize } = device.specs;

  if (device.category === "phone") {
    if (device.brand === "Apple") {
      return { itemType: "Apple", appleCategory: "iPhone", brand: "Apple", model: device.model, capacity: storage, conditionChecks };
    }
    return { itemType: "โทรศัพท์มือถือ", brand: device.brand, model: device.model, capacity: storage, conditionChecks };
  }

  if (device.category === "tablet") {
    if (device.brand === "Apple") {
      return { itemType: "Apple", appleCategory: "iPad", brand: "Apple", model: device.model, capacity: storage, conditionChecks };
    }
    return { itemType: "แท็บเล็ต", brand: device.brand, model: device.model, capacity: storage, conditionChecks };
  }

  if (device.category === "laptop") {
    const model = joined(device.model, device.variant);
    if (device.brand === "Apple") {
      // Astly's LINE form sends Apple specs as free text next to the model.
      const appleSpecs = [ram && `RAM ${ram}`, storage && `SSD ${storage}`, displaySize].filter(Boolean).join(" · ") || undefined;
      return { itemType: "Apple", appleCategory: "MacBook", brand: "Apple", model, capacity: storage, appleSpecs, conditionChecks };
    }
    return { itemType: "โน้ตบุค", brand: device.brand, model, ram, storage, screenSize: displaySize, conditionChecks };
  }

  throw new UnsupportedDeviceError(device.id);
}
