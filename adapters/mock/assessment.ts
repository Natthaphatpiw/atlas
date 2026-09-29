import type { AssessmentDefinition, AssessmentFeature, AssessmentQuestion } from "@/domain/assessment";
import { detailedIPhoneIds } from "@/data/devices";
import type { Device } from "@/domain/types";

// Development fixtures for a seller-reported preliminary assessment. They do
// not verify condition, ownership, repair history, or device-management state.
const sellerReportedHelp = "โปรดตอบตามข้อมูลที่คุณทราบ Atlas ยังไม่ได้ตรวจสอบข้อมูลนี้";

const yesNoUnknown = [
  { id: "yes", label: "ใช่" },
  { id: "no", label: "ไม่ใช่" },
  { id: "unknown", label: "ไม่ทราบ" },
];

const severityOptions = [
  { id: "none", label: "ไม่มี" },
  { id: "minor", label: "เล็กน้อย" },
  { id: "noticeable", label: "เห็นได้ชัด" },
  { id: "severe", label: "รุนแรง" },
  { id: "unknown", label: "ไม่ทราบ" },
];

const functionQuestion = (
  id: string,
  groupId: string,
  label: string,
  features?: AssessmentFeature[],
): AssessmentQuestion => ({
  id,
  sectionId: "functionality",
  groupId,
  label,
  help: sellerReportedHelp,
  type: "yes_no_unknown",
  required: true,
  options: yesNoUnknown,
  applicability: features ? { features } : undefined,
  visibleWhen: {
    all: [
      { questionId: "device_powers_on", operator: "not_equals", optionId: "no" },
    ],
  },
});

const iPhoneQuestions: AssessmentQuestion[] = [
  {
    id: "device_powers_on",
    sectionId: "basics",
    groupId: "basics_readiness",
    label: "เครื่องเปิดติดหรือไม่?",
    help: sellerReportedHelp,
    type: "yes_no_unknown",
    required: true,
    options: yesNoUnknown,
  },
  {
    id: "device_usable_normally",
    sectionId: "basics",
    groupId: "basics_readiness",
    label: "โดยรวมเครื่องใช้งานได้ตามปกติหรือไม่?",
    help: sellerReportedHelp,
    type: "yes_no_unknown",
    required: true,
    options: yesNoUnknown,
  },
  {
    id: "severe_physical_or_liquid_damage",
    sectionId: "basics",
    groupId: "basics_readiness",
    label: "มีความเสียหายรุนแรงหรือร่องรอยโดนน้ำ/ของเหลวหรือไม่?",
    help: sellerReportedHelp,
    type: "yes_no_unknown",
    required: true,
    options: yesNoUnknown,
  },

  {
    id: "display_glass_condition",
    sectionId: "physical",
    groupId: "physical_display",
    label: "กระจกหน้าจอมีรอยแตกหรือบิ่นระดับใด?",
    help: sellerReportedHelp,
    type: "single",
    required: true,
    options: severityOptions,
  },
  {
    id: "display_scratch_condition",
    sectionId: "physical",
    groupId: "physical_display",
    label: "หน้าจอมีรอยขีดข่วนระดับใด?",
    help: sellerReportedHelp,
    type: "single",
    required: true,
    options: severityOptions,
  },
  {
    id: "back_glass_condition",
    sectionId: "physical",
    groupId: "physical_body",
    label: "กระจกหรือฝาหลังมีความเสียหายระดับใด?",
    help: sellerReportedHelp,
    type: "single",
    required: true,
    options: severityOptions,
  },
  {
    id: "frame_body_condition",
    sectionId: "physical",
    groupId: "physical_body",
    label: "กรอบและตัวเครื่องมีรอยบุบหรือรอยขีดข่วนระดับใด?",
    help: sellerReportedHelp,
    type: "single",
    required: true,
    options: severityOptions,
  },
  {
    id: "camera_lens_condition",
    sectionId: "physical",
    groupId: "physical_body",
    label: "เลนส์กล้องมีรอยแตก รอยขีดข่วน หรือความเสียหายระดับใด?",
    help: sellerReportedHelp,
    type: "single",
    required: true,
    options: severityOptions,
  },

  functionQuestion("display_works", "function_display", "หน้าจอแสดงผลได้ปกติหรือไม่?"),
  functionQuestion("touchscreen_works", "function_display", "หน้าจอสัมผัสได้ปกติหรือไม่?"),
  functionQuestion("face_id_works", "function_display", "Face ID ใช้งานได้ปกติหรือไม่?", ["face_id"]),
  functionQuestion("touch_id_works", "function_display", "Touch ID ใช้งานได้ปกติหรือไม่?", ["touch_id"]),
  functionQuestion("front_camera_works", "function_cameras_audio", "กล้องหน้าใช้งานได้ปกติหรือไม่?"),
  functionQuestion("rear_camera_works", "function_cameras_audio", "กล้องหลังใช้งานได้ปกติหรือไม่?"),
  functionQuestion("speakers_work", "function_cameras_audio", "ลำโพงใช้งานได้ปกติหรือไม่?"),
  functionQuestion("microphones_work", "function_cameras_audio", "ไมโครโฟนใช้งานได้ปกติหรือไม่?"),
  functionQuestion("physical_buttons_work", "function_controls", "ปุ่มกดต่าง ๆ ใช้งานได้ปกติหรือไม่?"),
  functionQuestion("haptics_work", "function_controls", "การสั่นหรือ Haptics ใช้งานได้ปกติหรือไม่?"),
  functionQuestion("wired_charging_works", "function_controls", "การชาร์จผ่านสายใช้งานได้ปกติหรือไม่?"),
  functionQuestion("wireless_charging_works", "function_controls", "การชาร์จไร้สายใช้งานได้ปกติหรือไม่?", ["wireless_charging"]),
  functionQuestion("wifi_works", "function_connectivity", "Wi‑Fi ใช้งานได้ปกติหรือไม่?"),
  functionQuestion("bluetooth_works", "function_connectivity", "Bluetooth ใช้งานได้ปกติหรือไม่?"),
  functionQuestion("cellular_works", "function_connectivity", "การเชื่อมต่อเครือข่ายมือถือใช้งานได้ปกติหรือไม่?"),

  {
    id: "battery_health_percentage",
    sectionId: "battery",
    groupId: "battery_health",
    label: "Battery Health ที่แสดงในเครื่องเป็นกี่เปอร์เซ็นต์?",
    help: "กรอกค่าจาก การตั้งค่า > แบตเตอรี่ > สุขภาพแบตเตอรี่ หากทราบ; Atlas ยังไม่ได้ตรวจสอบข้อมูลนี้",
    type: "number",
    required: false,
    min: 0,
    max: 100,
    integer: true,
    allowUnknown: true,
    unit: "%",
  },
  {
    id: "battery_service_warning",
    sectionId: "battery",
    groupId: "battery_health",
    label: "มีข้อความแนะนำให้รับบริการแบตเตอรี่หรือคำเตือนเกี่ยวกับแบตเตอรี่หรือไม่?",
    help: sellerReportedHelp,
    type: "yes_no_unknown",
    required: true,
    options: yesNoUnknown,
  },
  {
    id: "battery_replaced",
    sectionId: "battery",
    groupId: "battery_health",
    label: "แบตเตอรี่เคยถูกเปลี่ยนหรือไม่?",
    help: sellerReportedHelp,
    type: "yes_no_unknown",
    required: true,
    options: yesNoUnknown,
  },

  {
    id: "repair_or_parts_replaced",
    sectionId: "repairs",
    groupId: "repairs_history",
    label: "เครื่องเคยซ่อมหรือเปลี่ยนอะไหล่หรือไม่?",
    help: sellerReportedHelp,
    type: "yes_no_unknown",
    required: true,
    options: yesNoUnknown,
  },
  {
    id: "repaired_components",
    sectionId: "repairs",
    groupId: "repairs_history",
    label: "หากเคยซ่อมหรือเปลี่ยนอะไหล่ โปรดเลือกส่วนที่เกี่ยวข้อง",
    help: sellerReportedHelp,
    type: "multi",
    required: true,
    visibleWhen: { all: [{ questionId: "repair_or_parts_replaced", operator: "equals", optionId: "yes" }] },
    options: [
      { id: "display", label: "หน้าจอ" },
      { id: "battery", label: "แบตเตอรี่" },
      { id: "camera", label: "กล้อง" },
      { id: "other", label: "ส่วนอื่น" },
      { id: "unknown", label: "ไม่ทราบรายละเอียด", exclusive: true },
    ],
  },
  {
    id: "display_replacement_provenance",
    sectionId: "repairs",
    groupId: "repairs_parts",
    label: "หน้าจอที่เปลี่ยนเป็นอะไหล่ลักษณะใด?",
    help: sellerReportedHelp,
    type: "single",
    required: true,
    visibleWhen: { all: [{ questionId: "repaired_components", operator: "includes", optionId: "display" }] },
    options: [
      { id: "genuine_or_original", label: "แท้หรืออะไหล่เดิมตามที่ผู้ขายทราบ" },
      { id: "used", label: "อะไหล่มือสอง" },
      { id: "third_party", label: "อะไหล่เทียบหรือจากผู้ผลิตรายอื่น" },
      { id: "unknown_unverified", label: "ไม่ทราบ/ยังไม่ได้ยืนยัน" },
    ],
  },
  {
    id: "battery_replacement_provenance",
    sectionId: "repairs",
    groupId: "repairs_parts",
    label: "แบตเตอรี่ที่เปลี่ยนเป็นอะไหล่ลักษณะใด?",
    help: sellerReportedHelp,
    type: "single",
    required: true,
    visibleWhen: {
      all: [{ questionId: "battery_replaced", operator: "not_equals", optionId: "no" }],
      any: [
        { questionId: "battery_replaced", operator: "equals", optionId: "yes" },
        { questionId: "repaired_components", operator: "includes", optionId: "battery" },
      ],
    },
    options: [
      { id: "genuine_or_original", label: "แท้หรืออะไหล่เดิมตามที่ผู้ขายทราบ" },
      { id: "used", label: "อะไหล่มือสอง" },
      { id: "third_party", label: "อะไหล่เทียบหรือจากผู้ผลิตรายอื่น" },
      { id: "unknown_unverified", label: "ไม่ทราบ/ยังไม่ได้ยืนยัน" },
    ],
  },
  {
    id: "camera_replacement_provenance",
    sectionId: "repairs",
    groupId: "repairs_parts",
    label: "กล้องที่เปลี่ยนเป็นอะไหล่ลักษณะใด?",
    help: sellerReportedHelp,
    type: "single",
    required: true,
    visibleWhen: { all: [{ questionId: "repaired_components", operator: "includes", optionId: "camera" }] },
    options: [
      { id: "genuine_or_original", label: "แท้หรืออะไหล่เดิมตามที่ผู้ขายทราบ" },
      { id: "used", label: "อะไหล่มือสอง" },
      { id: "third_party", label: "อะไหล่เทียบหรือจากผู้ผลิตรายอื่น" },
      { id: "unknown_unverified", label: "ไม่ทราบ/ยังไม่ได้ยืนยัน" },
    ],
  },

  {
    id: "find_my_enabled",
    sectionId: "security",
    groupId: "security_account",
    label: "ขณะนี้ Find My เปิดอยู่หรือไม่?",
    help: sellerReportedHelp,
    type: "yes_no_unknown",
    required: true,
    options: yesNoUnknown,
  },
  {
    id: "activation_lock_removal_ready",
    sectionId: "security",
    groupId: "security_account",
    label: "สามารถปิด Activation Lock และนำ Apple Account ออกจากเครื่องก่อนขายได้หรือไม่?",
    help: sellerReportedHelp,
    type: "yes_no_unknown",
    required: true,
    options: yesNoUnknown,
  },
  {
    id: "lost_mode_or_reported_lost",
    sectionId: "security",
    groupId: "security_status",
    label: "ตามที่คุณทราบ ขณะนี้เครื่องอยู่ใน Lost Mode หรือเคยถูกรายงานว่าสูญหายหรือไม่?",
    help: sellerReportedHelp,
    type: "yes_no_unknown",
    required: true,
    options: yesNoUnknown,
  },
  {
    id: "seller_can_sign_out_apple_account",
    sectionId: "security",
    groupId: "security_status",
    label: "คุณสามารถลงชื่อออกจาก Apple Account บนเครื่องนี้ได้หรือไม่?",
    help: sellerReportedHelp,
    type: "yes_no_unknown",
    required: true,
    options: yesNoUnknown,
  },

  {
    id: "organization_owned_or_managed",
    sectionId: "organization",
    groupId: "organization_management",
    label: "เครื่องเป็นของหรืออยู่ภายใต้การจัดการของบริษัท โรงเรียน หรือองค์กรหรือไม่?",
    help: sellerReportedHelp,
    type: "yes_no_unknown",
    required: true,
    options: yesNoUnknown,
  },
  {
    id: "supervised_status",
    sectionId: "organization",
    groupId: "organization_management",
    label: "ขณะนี้เครื่องอยู่ในสถานะ Supervised หรือไม่?",
    help: sellerReportedHelp,
    type: "yes_no_unknown",
    required: true,
    options: yesNoUnknown,
  },
  {
    id: "mdm_or_configuration_profile",
    sectionId: "organization",
    groupId: "organization_management",
    label: "ขณะนี้เครื่องมี MDM หรือโปรไฟล์การกำหนดค่าองค์กรหรือไม่?",
    help: sellerReportedHelp,
    type: "yes_no_unknown",
    required: true,
    options: yesNoUnknown,
  },
];

const reportedChoice = (
  id: string,
  sectionId: string,
  groupId: string,
  label: string,
  features?: AssessmentFeature[],
): AssessmentQuestion => ({
  id, sectionId, groupId, label, help: sellerReportedHelp,
  type: "yes_no_unknown", required: true, options: yesNoUnknown,
  applicability: features ? { features } : undefined,
});

const reportedSeverity = (
  id: string,
  groupId: string,
  label: string,
  features?: AssessmentFeature[],
): AssessmentQuestion => ({
  id, sectionId: "physical", groupId, label, help: sellerReportedHelp,
  type: "single", required: true, options: severityOptions,
  applicability: features ? { features } : undefined,
});

const runningQuestion = (
  id: string,
  groupId: string,
  label: string,
  features?: AssessmentFeature[],
): AssessmentQuestion => ({
  ...functionQuestion(id, groupId, label, features),
});

const sharedReadiness: AssessmentQuestion[] = [
  reportedChoice("device_powers_on", "basics", "basics_readiness", "เครื่องเปิดติดหรือไม่?"),
  reportedChoice("device_usable_normally", "basics", "basics_readiness", "โดยรวมเครื่องใช้งานได้ตามปกติหรือไม่?"),
  reportedChoice("severe_physical_or_liquid_damage", "basics", "basics_readiness", "มีความเสียหายรุนแรงหรือร่องรอยโดนน้ำ/ของเหลวหรือไม่?"),
];

const sharedRepairQuestions = (hasBuiltInDisplay: boolean, hasBattery: boolean): AssessmentQuestion[] => [
  reportedChoice("repair_or_parts_replaced", "repairs", "repairs_history", "เครื่องเคยซ่อมหรือเปลี่ยนอะไหล่หรือไม่?"),
  {
    id: "repaired_components", sectionId: "repairs", groupId: "repairs_history",
    label: "หากเคยซ่อมหรือเปลี่ยนอะไหล่ โปรดเลือกส่วนที่เกี่ยวข้อง",
    help: sellerReportedHelp, type: "multi", required: true,
    visibleWhen: { all: [{ questionId: "repair_or_parts_replaced", operator: "equals", optionId: "yes" }] },
    options: [
      ...(hasBuiltInDisplay ? [{ id: "display", label: "หน้าจอ" }] : []),
      ...(hasBattery ? [{ id: "battery", label: "แบตเตอรี่" }] : []),
      { id: "ports", label: "พอร์ตหรือช่องเสียบ" },
      { id: "board", label: "แผงวงจรหรือชิ้นส่วนภายใน" },
      { id: "other", label: "ส่วนอื่น" },
      { id: "unknown", label: "ไม่ทราบรายละเอียด", exclusive: true },
    ],
  },
  {
    id: "replacement_parts_source", sectionId: "repairs", groupId: "repairs_parts",
    label: "อะไหล่ที่เปลี่ยนเป็นอะไหล่ลักษณะใด?",
    help: sellerReportedHelp, type: "single", required: true,
    visibleWhen: { all: [{ questionId: "repair_or_parts_replaced", operator: "equals", optionId: "yes" }] },
    options: [
      { id: "genuine_or_original", label: "แท้หรืออะไหล่เดิมตามที่ผู้ขายทราบ" },
      { id: "used", label: "อะไหล่มือสอง" },
      { id: "third_party", label: "อะไหล่เทียบหรือจากผู้ผลิตรายอื่น" },
      { id: "mixed", label: "มีหลายประเภท" },
      { id: "unknown_unverified", label: "ไม่ทราบ/ยังไม่ได้ยืนยัน" },
    ],
  },
];

const sharedOrganizationQuestions: AssessmentQuestion[] = [
  reportedChoice("organization_owned_or_managed", "organization", "organization_management", "เครื่องเป็นของหรืออยู่ภายใต้การจัดการของบริษัท โรงเรียน หรือองค์กรหรือไม่?"),
  reportedChoice("mdm_or_configuration_profile", "organization", "organization_management", "เครื่องมีระบบจัดการอุปกรณ์หรือโปรไฟล์ขององค์กรหรือไม่?"),
  reportedChoice("organization_release_ready", "organization", "organization_management", "หากเป็นเครื่องขององค์กร สามารถปลดการจัดการและโอนสิทธิ์ก่อนขายได้หรือไม่?"),
];
sharedOrganizationQuestions[2].visibleWhen = {
  all: [{ questionId: "organization_owned_or_managed", operator: "equals", optionId: "yes" }],
};

const sharedAccessoryQuestions: AssessmentQuestion[] = [
  {
    id: "included_accessories", sectionId: "accessories", groupId: "accessories_included",
    label: "มีอุปกรณ์ใดส่งมอบพร้อมเครื่องบ้าง?",
    help: sellerReportedHelp, type: "multi", required: true,
    options: [
      { id: "charger_or_power_cord", label: "อะแดปเตอร์/สายชาร์จหรือสายไฟ" },
      { id: "original_box", label: "กล่องเดิม" },
      { id: "other", label: "อุปกรณ์อื่น" },
      { id: "none", label: "ไม่มี", exclusive: true },
      { id: "unknown", label: "ไม่ทราบ", exclusive: true },
    ],
  },
  reportedChoice("included_accessories_work", "accessories", "accessories_included", "อุปกรณ์ที่จะส่งมอบยังใช้งานได้ตามปกติหรือไม่?"),
];
sharedAccessoryQuestions[1].visibleWhen = {
  any: [
    { questionId: "included_accessories", operator: "includes", optionId: "charger_or_power_cord" },
    { questionId: "included_accessories", operator: "includes", optionId: "other" },
  ],
};

const tabletQuestions: AssessmentQuestion[] = [
  ...sharedReadiness,
  reportedSeverity("display_glass_condition", "physical_display", "กระจกหน้าจอมีรอยแตกหรือบิ่นระดับใด?"),
  reportedSeverity("display_scratch_condition", "physical_display", "หน้าจอมีรอยขีดข่วนระดับใด?"),
  reportedSeverity("back_cover_condition", "physical_body", "ฝาหลังมีรอยแตก รอยบุบ หรือรอยขีดข่วนระดับใด?"),
  reportedSeverity("frame_body_condition", "physical_body", "กรอบและตัวเครื่องมีความเสียหายระดับใด?"),
  reportedSeverity("frame_bending_condition", "physical_body", "ตัวเครื่องมีอาการคดหรืองอระดับใด?"),
  reportedSeverity("camera_lens_condition", "physical_body", "เลนส์กล้องมีความเสียหายระดับใด?"),
  runningQuestion("display_works", "function_display", "หน้าจอแสดงผลได้ปกติหรือไม่?"),
  runningQuestion("display_has_no_defects", "function_display", "หน้าจอไม่มีจุดเสีย เส้น หรือสีผิดปกติใช่หรือไม่?"),
  runningQuestion("touchscreen_works", "function_display", "หน้าจอสัมผัสได้ปกติหรือไม่?"),
  runningQuestion("stylus_works", "function_display", "การใช้งานปากกาสัมผัสกับหน้าจอได้ปกติหรือไม่?", ["stylus"]),
  runningQuestion("front_camera_works", "function_media", "กล้องหน้าใช้งานได้ปกติหรือไม่?"),
  runningQuestion("rear_camera_works", "function_media", "กล้องหลังใช้งานได้ปกติหรือไม่?"),
  runningQuestion("speakers_work", "function_media", "ลำโพงใช้งานได้ปกติหรือไม่?"),
  runningQuestion("microphones_work", "function_media", "ไมโครโฟนใช้งานได้ปกติหรือไม่?"),
  runningQuestion("physical_buttons_work", "function_controls", "ปุ่มกดต่าง ๆ ใช้งานได้ปกติหรือไม่?"),
  runningQuestion("charging_port_works", "function_controls", "พอร์ตชาร์จและการชาร์จผ่านสายใช้งานได้ปกติหรือไม่?"),
  runningQuestion("wifi_works", "function_connectivity", "Wi‑Fi ใช้งานได้ปกติหรือไม่?"),
  runningQuestion("bluetooth_works", "function_connectivity", "Bluetooth ใช้งานได้ปกติหรือไม่?"),
  runningQuestion("cellular_works", "function_connectivity", "การเชื่อมต่อเครือข่ายมือถือใช้งานได้ปกติหรือไม่?", ["cellular"]),
  reportedChoice("battery_holds_charge", "battery", "battery_condition", "แบตเตอรี่เก็บประจุและใช้งานได้ตามปกติหรือไม่?"),
  reportedChoice("battery_service_warning", "battery", "battery_condition", "มีข้อความเตือนหรืออาการผิดปกติเกี่ยวกับแบตเตอรี่หรือไม่?"),
  reportedChoice("battery_replaced", "battery", "battery_condition", "แบตเตอรี่เคยถูกเปลี่ยนหรือไม่?"),
  ...sharedRepairQuestions(true, true),
  reportedChoice("account_sign_out_ready", "security", "security_account", "สามารถลงชื่อออกจากบัญชีผู้ใช้และนำบัญชีออกจากเครื่องก่อนขายได้หรือไม่?"),
  reportedChoice("activation_lock_removal_ready", "security", "security_account", "สามารถปิดการล็อกการเปิดใช้งานหรือการป้องกันหลังรีเซ็ตก่อนขายได้หรือไม่?"),
  reportedChoice("lost_mode_or_reported_lost", "security", "security_status", "ตามที่คุณทราบ เครื่องอยู่ในโหมดสูญหายหรือเคยถูกรายงานว่าสูญหายหรือไม่?"),
  ...sharedOrganizationQuestions,
  ...sharedAccessoryQuestions,
];

const macBookQuestions: AssessmentQuestion[] = [
  ...sharedReadiness,
  reportedSeverity("display_glass_condition", "physical_display", "หน้าจอมีรอยแตกหรือบิ่นระดับใด?"),
  reportedSeverity("display_scratch_condition", "physical_display", "หน้าจอมีรอยขีดข่วนหรือรอยกดทับระดับใด?"),
  reportedSeverity("case_body_condition", "physical_body", "ฝาและตัวเครื่องมีรอยบุบหรือรอยขีดข่วนระดับใด?"),
  reportedSeverity("chassis_bending_condition", "physical_body", "ตัวเครื่องมีอาการคดหรืองอระดับใด?"),
  reportedSeverity("hinge_condition", "physical_body", "บานพับมีความเสียหายหรือหลวมระดับใด?"),
  reportedSeverity("keyboard_trackpad_condition", "physical_body", "คีย์บอร์ดและแทร็กแพดมีความเสียหายภายนอกระดับใด?"),
  runningQuestion("display_works", "function_display", "หน้าจอแสดงผลได้ปกติหรือไม่?"),
  runningQuestion("display_has_no_defects", "function_display", "หน้าจอไม่มีจุดเสีย เส้น หรือสีผิดปกติใช่หรือไม่?"),
  runningQuestion("keyboard_works", "function_input", "คีย์บอร์ดทุกปุ่มใช้งานได้ปกติหรือไม่?"),
  runningQuestion("trackpad_works", "function_input", "แทร็กแพดและการคลิกใช้งานได้ปกติหรือไม่?"),
  runningQuestion("touch_id_works", "function_input", "Touch ID ใช้งานได้ปกติหรือไม่?", ["touch_id"]),
  runningQuestion("camera_works", "function_media", "กล้องใช้งานได้ปกติหรือไม่?"),
  runningQuestion("microphones_work", "function_media", "ไมโครโฟนใช้งานได้ปกติหรือไม่?"),
  runningQuestion("speakers_work", "function_media", "ลำโพงใช้งานได้ปกติหรือไม่?"),
  runningQuestion("charging_works", "function_ports", "เครื่องรับไฟและชาร์จผ่านพอร์ตที่รองรับได้ปกติหรือไม่?"),
  runningQuestion("ports_work", "function_ports", "พอร์ตและช่องเสียบต่าง ๆ ใช้งานได้ปกติหรือไม่?"),
  runningQuestion("wifi_works", "function_connectivity", "Wi‑Fi ใช้งานได้ปกติหรือไม่?"),
  runningQuestion("bluetooth_works", "function_connectivity", "Bluetooth ใช้งานได้ปกติหรือไม่?"),
  reportedChoice("battery_holds_charge", "battery", "battery_condition", "แบตเตอรี่เก็บประจุและใช้งานได้ตามปกติหรือไม่?"),
  reportedChoice("battery_service_warning", "battery", "battery_condition", "มีข้อความแนะนำให้รับบริการแบตเตอรี่หรือคำเตือนหรือไม่?"),
  reportedChoice("battery_replaced", "battery", "battery_condition", "แบตเตอรี่เคยถูกเปลี่ยนหรือไม่?"),
  ...sharedRepairQuestions(true, true),
  reportedChoice("find_my_enabled", "security", "security_account", "ขณะนี้ Find My เปิดอยู่หรือไม่?"),
  reportedChoice("activation_lock_removal_ready", "security", "security_account", "สามารถปิด Activation Lock และนำ Apple Account ออกจากเครื่องก่อนขายได้หรือไม่?"),
  reportedChoice("lost_mode_or_reported_lost", "security", "security_status", "ตามที่คุณทราบ เครื่องอยู่ใน Lost Mode หรือเคยถูกรายงานว่าสูญหายหรือไม่?"),
  reportedChoice("seller_can_sign_out_apple_account", "security", "security_status", "คุณสามารถลงชื่อออกจาก Apple Account บนเครื่องนี้ได้หรือไม่?"),
  ...sharedOrganizationQuestions,
  ...sharedAccessoryQuestions,
];

const desktopQuestions = (builtInDisplay: boolean): AssessmentQuestion[] => [
  ...sharedReadiness,
  reportedSeverity("display_glass_condition", "physical_display", "หน้าจอในตัวเครื่องมีรอยแตกหรือบิ่นระดับใด?", ["built_in_display"]),
  reportedSeverity("display_scratch_condition", "physical_display", "หน้าจอในตัวเครื่องมีรอยขีดข่วนระดับใด?", ["built_in_display"]),
  reportedSeverity("case_body_condition", "physical_body", "ตัวเครื่องมีรอยบุบหรือรอยขีดข่วนระดับใด?"),
  reportedSeverity("ports_condition", "physical_body", "พอร์ตและช่องเสียบมีความเสียหายภายนอกระดับใด?"),
  runningQuestion("built_in_display_works", "function_display", "หน้าจอในตัวเครื่องแสดงผลได้ปกติหรือไม่?", ["built_in_display"]),
  runningQuestion("built_in_display_has_no_defects", "function_display", "หน้าจอในตัวเครื่องไม่มีจุดเสีย เส้น หรือสีผิดปกติใช่หรือไม่?", ["built_in_display"]),
  runningQuestion("external_display_output_works", "function_display", "การส่งภาพออกจอภายนอกใช้งานได้ปกติหรือไม่?"),
  runningQuestion("camera_works", "function_media", "กล้องในตัวเครื่องใช้งานได้ปกติหรือไม่?", ["built_in_camera"]),
  runningQuestion("microphones_work", "function_media", "ไมโครโฟนในตัวเครื่องใช้งานได้ปกติหรือไม่?", ["built_in_microphone"]),
  runningQuestion("speakers_work", "function_media", "ลำโพงในตัวเครื่องใช้งานได้ปกติหรือไม่?", ["built_in_speakers"]),
  runningQuestion("power_stability", "function_power", "เครื่องรับไฟและทำงานต่อเนื่องได้ปกติหรือไม่?"),
  runningQuestion("ports_work", "function_power", "พอร์ตและช่องเสียบต่าง ๆ ใช้งานได้ปกติหรือไม่?"),
  runningQuestion("fan_noise_normal", "function_power", "พัดลมหรือเสียงจากเครื่องทำงานตามปกติหรือไม่?"),
  runningQuestion("wifi_works", "function_connectivity", "Wi‑Fi ใช้งานได้ปกติหรือไม่?"),
  runningQuestion("bluetooth_works", "function_connectivity", "Bluetooth ใช้งานได้ปกติหรือไม่?"),
  ...sharedRepairQuestions(builtInDisplay, false),
  reportedChoice("find_my_enabled", "security", "security_account", "ขณะนี้ Find My เปิดอยู่หรือไม่?"),
  reportedChoice("activation_lock_removal_ready", "security", "security_account", "สามารถปิด Activation Lock และนำ Apple Account ออกจากเครื่องก่อนขายได้หรือไม่?"),
  reportedChoice("lost_mode_or_reported_lost", "security", "security_status", "ตามที่คุณทราบ เครื่องอยู่ใน Lost Mode หรือเคยถูกรายงานว่าสูญหายหรือไม่?"),
  reportedChoice("seller_can_sign_out_apple_account", "security", "security_status", "คุณสามารถลงชื่อออกจาก Apple Account บนเครื่องนี้ได้หรือไม่?"),
  ...sharedOrganizationQuestions,
  ...sharedAccessoryQuestions,
];

const extendedSections: AssessmentDefinition["sections"] = [
  { id: "basics", label: "ภาพรวมเครื่อง" },
  { id: "physical", label: "สภาพภายนอก" },
  { id: "functionality", label: "การทำงาน" },
  { id: "battery", label: "แบตเตอรี่" },
  { id: "repairs", label: "การซ่อมและอะไหล่" },
  { id: "security", label: "บัญชีและความปลอดภัย" },
  { id: "organization", label: "การจัดการโดยองค์กร" },
  { id: "accessories", label: "อุปกรณ์ที่ส่งมอบ" },
];

const basicQuestions: AssessmentQuestion[] = [
  {
    id: "device_powers_on",
    sectionId: "basics",
    groupId: "basic_condition",
    label: "เครื่องเปิดติดหรือไม่?",
    help: sellerReportedHelp,
    type: "yes_no_unknown",
    required: true,
    options: yesNoUnknown,
  },
  {
    id: "exterior_condition",
    sectionId: "basics",
    groupId: "basic_condition",
    label: "สภาพภายนอกมีความเสียหายระดับใด?",
    help: sellerReportedHelp,
    type: "single",
    required: true,
    options: severityOptions,
  },
  {
    id: "device_functions_normally",
    sectionId: "basics",
    groupId: "basic_condition",
    label: "โดยรวมเครื่องใช้งานได้ตามปกติหรือไม่?",
    help: sellerReportedHelp,
    type: "yes_no_unknown",
    required: true,
    options: yesNoUnknown,
  },
];

const iPhoneFeatures: AssessmentFeature[] = ["face_id", "wireless_charging"];
export function getMockAssessment(device: Device): AssessmentDefinition {
  const isIPhone = device.category === "phone" && device.brand === "Apple" && detailedIPhoneIds.has(device.id);

  if (isIPhone) {
    return {
      id: "seller_reported_iphone_v1",
      version: 1,
      coverage: "iphone",
      features: iPhoneFeatures,
      sections: [
        { id: "basics", label: "ภาพรวมเครื่อง" },
        { id: "physical", label: "สภาพภายนอก" },
        { id: "functionality", label: "การทำงาน" },
        { id: "battery", label: "แบตเตอรี่" },
        { id: "repairs", label: "การซ่อมและอะไหล่" },
        { id: "security", label: "บัญชีและความปลอดภัย" },
        { id: "organization", label: "การจัดการโดยองค์กร" },
      ],
      questions: iPhoneQuestions,
    };
  }

  if (device.category === "tablet") {
    const features: AssessmentFeature[] = [];
    if (/cellular|\b(?:4g|5g|lte)\b/i.test(device.specs.network ?? "")) features.push("cellular");
    if (device.capabilities?.stylus === true) features.push("stylus");
    return {
      id: "seller_reported_tablet_v1", version: 1, coverage: "tablet",
      features, sections: extendedSections, questions: tabletQuestions,
    };
  }

  if (device.category === "laptop" && device.brand === "Apple" && /^MacBook\b/i.test(device.model)) {
    return {
      id: "seller_reported_macbook_v1", version: 1, coverage: "macbook",
      features: ["touch_id"], sections: extendedSections, questions: macBookQuestions,
    };
  }

  if (device.category === "desktop" && device.brand === "Apple") {
    const builtIn = /^iMac\b/i.test(device.model);
    return {
      id: "seller_reported_mac_desktop_v1", version: 1, coverage: "desktop",
      features: builtIn ? ["built_in_display", "built_in_camera", "built_in_microphone", "built_in_speakers"] : [],
      sections: extendedSections.filter((section) => section.id !== "battery"),
      questions: desktopQuestions(builtIn),
    };
  }

  return {
    id: "seller_reported_basic_v1",
    version: 1,
    coverage: "basic",
    features: [],
    sections: [{ id: "basics", label: "ภาพรวมเครื่อง" }],
    questions: basicQuestions,
  };
}
