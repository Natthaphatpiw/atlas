import type { AssessmentAnswer, AssessmentDefinition, AssessmentQuestion, AssessmentValue } from "@/domain/assessment";
import type { Device } from "@/domain/types";
import { applicableQuestions, pruneAnswers } from "@/lib/assessment";

// Atlas's own condition score (0–100) from the seller's answers. It is the
// multiplier on the used-market price: price = market price × score / 100.
//
// Each question has a weight (the most it alone can take off 100) and, for
// every answer, the share of that weight it keeps (1 = no penalty). Questions
// about one part share a group, so the worst fault counts in full and the rest
// only partly; groups then multiply, so faults compound without going below 0
// and one fatal fault is never diluted by many healthy answers. Weights are
// absolute: a question that does not apply to a device costs nothing and its
// weight is not handed to other questions, so the same fault costs the same on
// every device. Storage, chip and other specs are not scored: they already set
// Astly's market price.
//
// "ไม่ทราบ" keeps a little less than a healthy answer, by how easily the seller
// could know it; all unknowns together can take off at most 18%, and a device
// whose power-on state is unknown scores at most 80.
//
// Designed 2026-10-23 from three independent proposals (Astly-aligned, Thai
// resale value, scoring robustness) and checked against shared scenarios.
// Calibrate later against real offers.

export const CONDITION_MODEL_VERSION = "atlas_condition_v1";

type Group = "power" | "liquid" | "stability" | "display" | "body" | "camera" | "biometric" | "io" | "battery" | "repairs";

interface Rule {
  group: Group;
  weight: number;
  /** Share of the weight kept for each option id (1 = no penalty). */
  options?: Record<string, number>;
  /** Share kept for "ไม่ทราบ" or a missing answer. */
  unknown: number;
}

const yes = (unknown: number) => ({ yes: 1, no: 0, unknown });
const no = (bad: number, unknown: number) => ({ no: 1, yes: bad, unknown });
const severity = (minor: number, noticeable: number, severe: number, unknown: number) =>
  ({ none: 1, minor, noticeable, severe, unknown });
const source = (genuine: number, used: number, thirdParty: number, unverified: number, mixed?: number) => ({
  genuine_or_original: genuine, used, third_party: thirdParty, unknown_unverified: unverified,
  ...(mixed === undefined ? {} : { mixed }),
});

/** How groups combine: worst fault + share × the rest, at most cap points. */
const GROUPS: Record<Group, { share: number; cap: number }> = {
  power: { share: 0, cap: 100 },
  liquid: { share: 0, cap: 100 },
  stability: { share: 0, cap: 100 },
  display: { share: 0.25, cap: 60 },
  body: { share: 0.5, cap: 35 },
  camera: { share: 0.5, cap: 30 },
  biometric: { share: 0.5, cap: 30 },
  io: { share: 1, cap: 40 },
  battery: { share: 0, cap: 16 },
  repairs: { share: 1, cap: 35 },
};

export const CONDITION_RULES: Record<string, Rule> = {
  device_powers_on: { group: "power", weight: 85, options: yes(0.8), unknown: 0.8 },
  severe_physical_or_liquid_damage: { group: "liquid", weight: 50, options: no(0, 0.9), unknown: 0.9 },
  power_stability: { group: "stability", weight: 45, options: yes(0.85), unknown: 0.85 },

  display_glass_condition: { group: "display", weight: 40, options: severity(0.75, 0.2, 0, 0.8), unknown: 0.8 },
  display_scratch_condition: { group: "display", weight: 12, options: severity(0.8, 0.5, 0.2, 0.8), unknown: 0.8 },
  display_works: { group: "display", weight: 55, options: yes(0.85), unknown: 0.85 },
  built_in_display_works: { group: "display", weight: 55, options: yes(0.85), unknown: 0.85 },
  touchscreen_works: { group: "display", weight: 45, options: yes(0.85), unknown: 0.85 },
  stylus_works: { group: "display", weight: 8, options: yes(0.95), unknown: 0.95 },

  back_glass_condition: { group: "body", weight: 20, options: severity(0.85, 0.4, 0, 0.8), unknown: 0.8 },
  frame_body_condition: { group: "body", weight: 20, options: severity(0.88, 0.45, 0.1, 0.8), unknown: 0.8 },
  back_cover_condition: { group: "body", weight: 15, options: severity(0.88, 0.45, 0.1, 0.8), unknown: 0.8 },
  frame_bending_condition: { group: "body", weight: 20, options: severity(0.7, 0.35, 0, 0.85), unknown: 0.85 },
  exterior_condition: { group: "body", weight: 22, options: severity(0.85, 0.45, 0.1, 0.8), unknown: 0.8 },
  case_body_condition: { group: "body", weight: 18, options: severity(0.88, 0.45, 0.1, 0.8), unknown: 0.8 },
  chassis_bending_condition: { group: "body", weight: 20, options: severity(0.7, 0.35, 0, 0.85), unknown: 0.85 },
  hinge_condition: { group: "body", weight: 15, options: severity(0.8, 0.4, 0, 0.85), unknown: 0.85 },
  keyboard_trackpad_condition: { group: "body", weight: 8, options: severity(0.9, 0.6, 0.2, 0.85), unknown: 0.85 },

  camera_lens_condition: { group: "camera", weight: 10, options: severity(0.85, 0.4, 0.1, 0.85), unknown: 0.85 },
  rear_camera_works: { group: "camera", weight: 22, options: yes(0.85), unknown: 0.85 },
  front_camera_works: { group: "camera", weight: 12, options: yes(0.85), unknown: 0.85 },
  cameras_work: { group: "camera", weight: 18, options: yes(0.85), unknown: 0.85 },
  camera_works: { group: "camera", weight: 8, options: yes(0.9), unknown: 0.9 },

  face_id_works: { group: "biometric", weight: 25, options: yes(0.8), unknown: 0.8 },
  touch_id_works: { group: "biometric", weight: 10, options: yes(0.85), unknown: 0.85 },

  ports_condition: { group: "io", weight: 8, options: severity(0.9, 0.5, 0.15, 0.85), unknown: 0.85 },
  physical_buttons_work: { group: "io", weight: 8, options: yes(0.85), unknown: 0.85 },
  wired_charging_works: { group: "io", weight: 15, options: yes(0.85), unknown: 0.85 },
  charging_port_works: { group: "io", weight: 15, options: yes(0.85), unknown: 0.85 },
  charging_works: { group: "io", weight: 30, options: yes(0.85), unknown: 0.85 },
  ports_work: { group: "io", weight: 12, options: yes(0.85), unknown: 0.85 },
  buttons_ports_work: { group: "io", weight: 15, options: yes(0.85), unknown: 0.85 },
  external_display_output_works: { group: "io", weight: 12, options: yes(0.9), unknown: 0.9 },
  keyboard_works: { group: "io", weight: 18, options: yes(0.85), unknown: 0.85 },
  trackpad_works: { group: "io", weight: 15, options: yes(0.85), unknown: 0.85 },
  speakers_work: { group: "io", weight: 10, options: yes(0.85), unknown: 0.85 },
  wifi_works: { group: "io", weight: 18, options: yes(0.85), unknown: 0.85 },
  cellular_works: { group: "io", weight: 20, options: yes(0.85), unknown: 0.85 },
  fan_noise_normal: { group: "io", weight: 6, options: yes(0.9), unknown: 0.9 },

  battery_health_percentage: { group: "battery", weight: 16, unknown: 0.85 },
  battery_service_warning: { group: "battery", weight: 16, options: no(0.1, 0.85), unknown: 0.85 },
  battery_holds_charge: { group: "battery", weight: 16, options: yes(0.85), unknown: 0.85 },
  battery_degraded: { group: "battery", weight: 16, options: no(0.1, 0.85), unknown: 0.85 },

  repair_or_parts_replaced: { group: "repairs", weight: 10, options: no(0.75, 0.6), unknown: 0.6 },
  repaired_components: {
    group: "repairs", weight: 12, unknown: 0.5,
    options: { display: 0.85, battery: 1, camera: 0.9, ports: 0.9, board: 0.2, other: 0.85, unknown: 0.5 },
  },
  display_replacement_provenance: { group: "repairs", weight: 20, options: source(0.95, 0.6, 0.1, 0.35), unknown: 0.35 },
  battery_replacement_provenance: { group: "repairs", weight: 10, options: source(1, 0.6, 0.3, 0.5), unknown: 0.5 },
  camera_replacement_provenance: { group: "repairs", weight: 10, options: source(0.95, 0.6, 0.3, 0.5), unknown: 0.5 },
  replacement_parts_source: { group: "repairs", weight: 15, options: source(0.95, 0.6, 0.25, 0.45, 0.4), unknown: 0.45 },
};

/** Battery Health % bands: share kept. */
const BATTERY_BANDS: Array<{ min: number; retained: number }> = [
  { min: 95, retained: 1 }, { min: 90, retained: 0.95 }, { min: 85, retained: 0.8 },
  { min: 80, retained: 0.6 }, { min: 70, retained: 0.2 }, { min: 0, retained: 0 },
];

const BATTERY_QUESTIONS = new Set(["battery_health_percentage", "battery_service_warning", "battery_holds_charge", "battery_degraded"]);
/** All unknowns together keep at least this share of the known-answers score. */
const UNKNOWN_FLOOR = 0.82;
const DEAD_DEVICE_CAP = 15;
const UNTESTED_POWER_CAP = 80;

/** The few per-device weight exceptions: tablets lean less on cameras and cellular; a Mac mini has only external displays. */
function weightFor(questionId: string, definition: AssessmentDefinition) {
  if (definition.coverage === "tablet") {
    const tablet: Record<string, number> = { cellular_works: 10, rear_camera_works: 12, front_camera_works: 6 };
    if (questionId in tablet) return tablet[questionId];
  }
  if (definition.coverage === "desktop" && !definition.features.includes("built_in_display") && questionId === "external_display_output_works") return 30;
  return CONDITION_RULES[questionId].weight;
}

/** Share kept for one answer, and whether it counts as "ไม่ทราบ". */
function retained(question: AssessmentQuestion, rule: Rule, value: AssessmentValue | undefined): { retained: number; unknown: boolean } {
  if (!value || value.kind === "unknown" || value.kind === "skipped") return { retained: rule.unknown, unknown: true };
  if (value.kind === "number") {
    if (question.id !== "battery_health_percentage") return { retained: rule.unknown, unknown: true };
    const band = BATTERY_BANDS.find((candidate) => value.value >= candidate.min) ?? BATTERY_BANDS[BATTERY_BANDS.length - 1];
    return { retained: band.retained, unknown: false };
  }
  if (value.kind === "multi") {
    const shares = value.optionIds.map((id) => rule.options?.[id]).filter((share): share is number => share !== undefined);
    return shares.length ? { retained: Math.min(...shares), unknown: false } : { retained: rule.unknown, unknown: true };
  }
  // A choice of "ไม่ทราบ" is an unknown; repaired_components' "unknown" is a real answer (handled as multi above).
  if (value.optionId === "unknown") return { retained: rule.unknown, unknown: true };
  const share = rule.options?.[value.optionId];
  return share === undefined ? { retained: rule.unknown, unknown: true } : { retained: share, unknown: false };
}

export interface ConditionScore {
  /** 0–100; use score / 100 as the price multiplier. */
  score: number;
  model: typeof CONDITION_MODEL_VERSION;
  /** Points each group took off, for records and analysis. */
  groups: Array<{ group: Group; points: number }>;
}

/** Atlas's condition score for a device and its seller-reported answers. */
export function conditionScore(definition: AssessmentDefinition, device: Device, answers: AssessmentAnswer[]): ConditionScore {
  const valid = new Map(pruneAnswers(definition, device, answers).map((answer) => [answer.questionId, answer.value]));
  const questions = applicableQuestions(definition, device, answers).filter((question) => question.id in CONDITION_RULES);
  const power = valid.get("device_powers_on");
  const powered = power?.kind === "choice" && (power.optionId === "yes" || power.optionId === "no") ? power.optionId : "unknown";

  const penalties = new Map<Group, Array<{ points: number; unknown: boolean }>>();
  for (const question of questions) {
    // A device that does not power on cannot report on its battery.
    if (powered === "no" && BATTERY_QUESTIONS.has(question.id)) continue;
    const rule = CONDITION_RULES[question.id];
    const answer = retained(question, rule, valid.get(question.id));
    const list = penalties.get(rule.group) ?? [];
    list.push({ points: weightFor(question.id, definition) * (1 - answer.retained), unknown: answer.unknown });
    penalties.set(rule.group, list);
  }
  // A known battery answer outweighs unknown ones about the same battery.
  const battery = penalties.get("battery");
  if (battery?.some((entry) => !entry.unknown)) penalties.set("battery", battery.filter((entry) => !entry.unknown));

  const groupPoints = (entries: Array<{ points: number; unknown: boolean }>, group: Group, withUnknowns: boolean) => {
    const values = entries.map((entry) => (withUnknowns || !entry.unknown ? entry.points : 0));
    const worst = Math.max(0, ...values);
    const total = values.reduce((sum, points) => sum + points, 0);
    return Math.min(GROUPS[group].cap, worst + GROUPS[group].share * (total - worst));
  };
  const factor = (withUnknowns: boolean) => {
    let product = 1;
    for (const [group, entries] of penalties) product *= 1 - groupPoints(entries, group, withUnknowns) / 100;
    return product;
  };

  let score = 100 * Math.max(UNKNOWN_FLOOR * factor(false), factor(true));
  if (powered === "no") score = Math.min(score, DEAD_DEVICE_CAP);
  if (powered === "unknown") score = Math.min(score, UNTESTED_POWER_CAP);
  const final = Math.min(100, Math.max(0, Math.round(score + 1e-9)));

  const groups = [...penalties]
    .map(([group, entries]) => ({ group, points: Math.round(groupPoints(entries, group, true) * 10) / 10 }))
    .filter((entry) => entry.points > 0);
  return { score: final, model: CONDITION_MODEL_VERSION, groups };
}

/** The stored `condition_deductions`: each group's points, tagged with the model that scored them. */
export function conditionDeductions({ model, groups }: ConditionScore) {
  return groups.map((entry) => ({ model, ...entry }));
}
