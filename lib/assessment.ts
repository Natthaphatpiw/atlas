import type { AssessmentAnswer, AssessmentDefinition, AssessmentQuestion, AssessmentRule, AssessmentValue, SellerAssessment } from "@/domain/assessment";
import type { Device } from "@/domain/types";

export function answerError(question: AssessmentQuestion, value: AssessmentValue | undefined): string | null {
  if (!value) return question.required ? "กรุณาตอบคำถามนี้" : null;
  if (value.kind === "skipped") return question.required ? "กรุณาตอบคำถามนี้" : null;
  if (question.type === "number") {
    if (value.kind === "unknown" && question.allowUnknown) return null;
    return value.kind === "number" && Number.isFinite(value.value) &&
      (!question.integer || Number.isInteger(value.value)) && value.value >= question.min && value.value <= question.max
      ? null : `กรุณาระบุจำนวน${question.integer ? "เต็ม" : ""} ${question.min}–${question.max} ${question.unit}`;
  }
  if (question.type === "multi") {
    if (value.kind !== "multi" || !Array.isArray(value.optionIds) || !value.optionIds.length ||
      new Set(value.optionIds).size !== value.optionIds.length ||
      value.optionIds.some((id) => !question.options.some((option) => option.id === id)) ||
      (value.optionIds.length > 1 && question.options.some((option) => option.exclusive && value.optionIds.includes(option.id)))) {
      return "กรุณาเลือกคำตอบที่สอดคล้องกัน";
    }
    return null;
  }
  return value.kind === "choice" && question.options.some((option) => option.id === value.optionId)
    ? null : "กรุณาเลือกคำตอบ";
}

function matchesRule(rule: AssessmentRule, answers: Map<string, AssessmentAnswer>) {
  const value = answers.get(rule.questionId)?.value;
  if (!value) return false;
  if (rule.operator === "includes") return value.kind === "multi" && value.optionIds.includes(rule.optionId);
  if (value.kind !== "choice") return false;
  return rule.operator === "equals" ? value.optionId === rule.optionId : value.optionId !== rule.optionId;
}

// Evaluate in definition order: hidden/invalid answers cannot activate child branches.
export function applicableQuestions(definition: AssessmentDefinition, device: Device, answers: AssessmentAnswer[]) {
  const available = new Map<string, AssessmentAnswer>();
  const supplied = new Map(answers.map((answer) => [answer.questionId, answer]));
  return definition.questions.filter((question) => {
    const applies = (!question.applicability?.categories || question.applicability.categories.includes(device.category)) &&
      (!question.applicability?.features || question.applicability.features.every((feature) => definition.features.includes(feature))) &&
      (!question.visibleWhen?.all || question.visibleWhen.all.every((rule) => matchesRule(rule, available))) &&
      (!question.visibleWhen?.any || question.visibleWhen.any.some((rule) => matchesRule(rule, available)));
    if (applies) {
      const answer = supplied.get(question.id);
      if (answer && !answerError(question, answer.value)) available.set(question.id, answer);
    }
    return applies;
  });
}

export function pruneAnswers(definition: AssessmentDefinition, device: Device, answers: AssessmentAnswer[]) {
  const supplied = new Map(answers.map((answer) => [answer.questionId, answer]));
  return applicableQuestions(definition, device, answers).flatMap((question) => {
    const answer = supplied.get(question.id);
    if (!answer || answerError(question, answer.value)) return [];
    const value = answer.value.kind === "multi"
      ? { ...answer.value, optionIds: [...answer.value.optionIds].sort() } : answer.value;
    return [{ ...answer, value }];
  });
}

export function isCurrentAssessment(assessment: SellerAssessment | undefined, definition: AssessmentDefinition): assessment is SellerAssessment {
  return Boolean(assessment && assessment.source === "seller_reported" && assessment.definitionId === definition.id &&
    assessment.version === definition.version && Array.isArray(assessment.answers) &&
    assessment.answers.every((answer) => {
      if (!answer || typeof answer.questionId !== "string" || typeof answer.answeredAt !== "string" || !answer.value) return false;
      const value = answer.value;
      switch (value.kind) {
        case "choice": return typeof value.optionId === "string";
        case "multi": return Array.isArray(value.optionIds) && value.optionIds.every((id) => typeof id === "string");
        case "number": return typeof value.value === "number" && Number.isFinite(value.value);
        case "unknown": case "skipped": return true;
        default: return false;
      }
    }) && new Set(assessment.answers.map((answer) => answer.questionId)).size === assessment.answers.length);
}

export function assessmentComplete(definition: AssessmentDefinition, device: Device, answers: AssessmentAnswer[]) {
  const questions = applicableQuestions(definition, device, answers);
  const supplied = new Map(answers.map((answer) => [answer.questionId, answer]));
  return questions.length > 0 && questions.every((question) => !answerError(question, supplied.get(question.id)?.value));
}

export function assessmentProgress(definition: AssessmentDefinition, device: Device, answers: AssessmentAnswer[], groupId: string | null) {
  const questions = applicableQuestions(definition, device, answers);
  const groupIds = [...new Set(questions.map((question) => question.groupId))];
  const currentGroupId = groupId && groupIds.includes(groupId) ? groupId : groupIds[0] ?? null;
  const currentGroup = questions.find((question) => question.groupId === currentGroupId);
  const sectionIndex = definition.sections.findIndex((section) => section.id === currentGroup?.sectionId);
  const answered = questions.filter((question) => {
    const answer = answers.find((item) => item.questionId === question.id);
    return Boolean(answer && !answerError(question, answer.value));
  }).length;
  return {
    questions,
    groupIds,
    currentGroupId,
    sectionIndex,
    groupIndex: currentGroupId ? groupIds.indexOf(currentGroupId) : 0,
    answered,
    total: questions.length,
    percentage: questions.length ? (answered / questions.length) * 100 : 0,
  };
}

export function answerLabel(question: AssessmentQuestion, value: AssessmentValue) {
  if (value.kind === "unknown") return "ไม่ทราบ";
  if (value.kind === "skipped") return "ข้ามคำถามนี้";
  if (value.kind === "number") return `${value.value}${question.type === "number" ? ` ${question.unit}` : ""}`;
  if (question.type === "number") return "ไม่ทราบ";
  if (value.kind === "choice") return question.options.find((option) => option.id === value.optionId)?.label ?? "ไม่ทราบ";
  return question.options.filter((option) => value.optionIds.includes(option.id)).map((option) => option.label).join(" · ");
}

export function answerIdentity(answers: AssessmentAnswer[]) {
  return JSON.stringify(answers.map(({ questionId, value }) => {
    const canonical = value.kind === "choice" ? { kind: value.kind, optionId: value.optionId }
      : value.kind === "multi" ? { kind: value.kind, optionIds: [...value.optionIds].sort() }
        : value.kind === "number" ? { kind: value.kind, value: value.value } : { kind: value.kind };
    return { questionId, value: canonical };
  }).sort((left, right) => left.questionId.localeCompare(right.questionId)));
}

// Empty is a deliberate clear; malformed drafts must not overwrite a saved answer.
export function parseNumericDraft(question: Extract<AssessmentQuestion, { type: "number" }>, text: string): { valid: boolean; value?: AssessmentValue } {
  if (text === "") return { valid: true };
  const format = question.integer ? /^\d+$/ : /^\d+(\.\d+)?$/;
  const value: AssessmentValue = { kind: "number", value: Number(text) };
  return format.test(text) && !answerError(question, value) ? { valid: true, value } : { valid: false };
}
