"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FlowActions, FlowBack, FlowForward } from "@/components/flow-actions";
import { MockAnalyticsService } from "@/adapters/mock/analytics";
import type { AssessmentAnswer, AssessmentDefinition, AssessmentQuestion, AssessmentValue } from "@/domain/assessment";
import { answerError, answerIdentity, answerLabel, applicableQuestions, assessmentComplete, assessmentProgress, isCurrentAssessment, parseNumericDraft, pruneAnswers } from "@/lib/assessment";
import { hasReachedStage, saveAssessmentAnswers, type StoredValuationSession } from "@/lib/valuation-session";

const focus = "atlas-focus";
const primary = `atlas-interactive ${focus} w-full rounded-[var(--radius-control)] border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-5 py-3.5 font-semibold text-white`;
const analytics = new MockAnalyticsService();

export function DeviceAssessment({ initial, definition }: { initial: StoredValuationSession; definition: AssessmentDefinition }) {
  const router = useRouter();
  const existing = initial.session.assessment;
  const compatible = isCurrentAssessment(existing, definition);
  const [needsRecovery, setNeedsRecovery] = useState(!compatible && Boolean(existing || initial.session.conditionAnswers?.length || hasReachedStage(initial.session.status, "condition_completed")));
  const [answers, setAnswers] = useState<AssessmentAnswer[]>(() => compatible ? pruneAnswers(definition, initial.device, existing.answers) : []);
  const initialQuestions = applicableQuestions(definition, initial.device, answers);
  const [groupId, setGroupId] = useState<string | null>(() => initialQuestions.find((question) => question.required && answerError(question, answers.find((answer) => answer.questionId === question.id)?.value))?.groupId ?? null);
  const [editing, setEditing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const confirmed = useRef(new Map(answers.map((answer) => [answer.questionId, JSON.stringify(answer.value)])));
  const navigating = useRef(false);
  const questions = applicableQuestions(definition, initial.device, answers);
  const progress = assessmentProgress(definition, initial.device, answers, groupId);
  const groupIds = progress.groupIds;
  const activeGroupId = progress.currentGroupId;
  const group = questions.filter((question) => question.groupId === activeGroupId);
  const sectionId = group[0]?.sectionId;
  const sectionIndex = definition.sections.findIndex((section) => section.id === sectionId);
  const complete = assessmentComplete(definition, initial.device, answers);
  const review = !groupId;

  useEffect(() => { heading.current?.focus(); }, [groupId, needsRecovery]);

  const persist = (next: AssessmentAnswer[], reviewed = false) => {
    try {
      const saved = saveAssessmentAnswers(definition, next, reviewed);
      setSaveError(!saved);
      return saved;
    } catch {
      setSaveError(true);
      return null;
    }
  };

  const changeAnswer = (question: AssessmentQuestion, value: AssessmentValue | undefined) => {
    const next = answers.filter((answer) => answer.questionId !== question.id);
    if (value && !answerError(question, value)) next.push({ questionId: question.id, value, answeredAt: new Date().toISOString() });
    const clean = pruneAnswers(definition, initial.device, next);
    const retained = new Set(clean.map((answer) => answer.questionId));
    for (const questionId of confirmed.current.keys()) {
      if (!retained.has(questionId)) confirmed.current.delete(questionId);
    }
    setAnswers(clean);
    persist(clean);
  };

  const context = { sessionId: initial.session.id, route: "/valuation/condition", deviceCategory: initial.device.category,
    deviceId: initial.device.id, assessmentVersion: definition.version };

  const continueGroup = (event: FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
    const invalid = group.find((question) => answerError(question, answers.find((answer) => answer.questionId === question.id)?.value));
    if (invalid || form.current?.querySelector('[aria-invalid="true"]')) {
      const fieldset = invalid ? document.getElementById(`field-${invalid.id}`) : null;
      (fieldset?.querySelector<HTMLInputElement>("input") ?? form.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]'))?.focus();
      return;
    }
    if (!persist(answers)) return;
    group.forEach((question) => {
      const value = answers.find((answer) => answer.questionId === question.id)?.value;
      const identity = JSON.stringify(value);
      if (value && confirmed.current.get(question.id) !== identity) {
        analytics.track({ ...context, eventName: "condition_question_answered", questionId: question.id, timestamp: new Date().toISOString() });
        confirmed.current.set(question.id, identity);
      }
    });
    setShowErrors(false);
    const missing = questions.find((question) => question.required && answerError(question, answers.find((answer) => answer.questionId === question.id)?.value));
    if (editing) {
      setGroupId(missing?.groupId ?? null);
      if (!missing) setEditing(false);
    } else {
      setGroupId(groupIds[groupIds.indexOf(activeGroupId ?? "") + 1] ?? missing?.groupId ?? null);
    }
  };

  const finish = () => {
    if (!complete || navigating.current) return;
    const saved = persist(answers, true);
    if (!saved) return;
    navigating.current = true;
    const unchangedReview = compatible && existing?.reviewedAt && answerIdentity(existing.answers) === answerIdentity(answers);
    if (!unchangedReview) analytics.track({ ...context, eventName: "condition_section_completed", timestamp: new Date().toISOString() });
    router.push("/valuation/result");
  };

  const back = () => {
    setShowErrors(false);
    if (editing) { setEditing(false); setGroupId(null); return; }
    if (review && groupIds.length) { setGroupId(groupIds[groupIds.length - 1]); return; }
    const index = groupIds.indexOf(activeGroupId ?? "");
    if (index > 0) setGroupId(groupIds[index - 1]);
    else router.push("/valuation/device");
  };

  return (
    <AppShell title="ประเมินสภาพด้วยตนเอง" description="ข้อมูลจากผู้ขายสำหรับราคาประเมินเบื้องต้น" compactHeader flowStage="condition" backAction={<span className="hidden" aria-hidden="true" />}>
      <div className="mx-auto max-w-[820px]">
        <div className="mb-6 rounded-[var(--radius-surface)] border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] p-4 shadow-[var(--shadow-tactile-sm)]">
          <p className="font-semibold text-slate-900">{initial.device.model}</p>
          <p className="mt-1 text-sm text-slate-600">{Object.values(initial.device.specs).filter(Boolean).join(" · ")}</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">ข้อมูลนี้เป็นคำตอบของผู้ขาย ยังไม่ใช่ผลตรวจสอบจาก Atlas การตรวจเครื่องจริงภายหลังอาจเปลี่ยนสภาพที่ยืนยันและราคาสุดท้าย</p>
          {definition.coverage === "basic" ? <p className="mt-2 text-sm text-slate-600">สินค้ารุ่นนี้ใช้แบบประเมินเบื้องต้นแบบย่อ ข้อมูลตัวอย่างยังไม่ครอบคลุมทุกฟังก์ชัน</p> : null}
        </div>
        {saveError ? <p role="alert" className="mb-4 text-sm text-rose-700">บันทึกคำตอบไม่ได้ กรุณากลับไปเลือกสินค้าแล้วลองอีกครั้ง</p> : null}
        {needsRecovery ? (
          <section>
            <h2 ref={heading} tabIndex={-1} className={`text-xl font-semibold ${focus}`}>กรุณาทำแบบประเมินสภาพฉบับใหม่</h2>
            <p className="my-4 text-sm leading-6 text-slate-600">คำตอบเดิมใช้แบบประเมินคนละฉบับ จึงนำมาแทนคำตอบใหม่ไม่ได้ สินค้าที่เลือกจะยังอยู่ {existing ? "คำตอบของแบบประเมินที่ใช้ไม่ได้จะถูกแทนที่" : "คำตอบ Condition เดิมจะยังเก็บอยู่โดยไม่แปลงเป็นคำตอบใหม่"} เมื่อเริ่มใหม่ ราคาที่กรอกและความคืบหน้าหลังขั้นตอนสภาพจะถูกล้าง</p>
            <button type="button" className={primary} onClick={() => {
              if (!persist([])) return;
              setAnswers([]); setGroupId(initialQuestions[0]?.groupId ?? null); setNeedsRecovery(false);
            }}>เริ่มแบบประเมินใหม่</button>
          </section>
        ) : review ? (
          <section>
            <h2 ref={heading} tabIndex={-1} className={`text-2xl font-semibold ${focus}`}>ตรวจสอบคำตอบของคุณ</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">ตรวจสอบข้อมูลที่คุณรายงานก่อนดูผลประเมินเบื้องต้น คุณสามารถแก้ไขแต่ละคำตอบได้</p>
            {!complete ? <p role="status" className="mt-3 text-sm text-amber-800">มีคำถามที่ต้องตอบเพิ่มเติมหลังจากแก้ไขข้อมูล</p> : null}
            <div className="my-6 space-y-5">
              {definition.sections.map((section) => {
                const relevant = questions.filter((question) => question.sectionId === section.id);
                if (!relevant.length) return null;
                return <section key={section.id} aria-labelledby={`review-${section.id}`} className="rounded-[var(--radius-surface)] border border-[var(--color-border-strong)] bg-white p-4 shadow-[var(--shadow-tactile-sm)] sm:p-5">
                  <h3 id={`review-${section.id}`} className="font-semibold text-slate-900">{section.label}</h3>
                  <dl className="mt-3 divide-y divide-slate-100">
                    {relevant.map((question) => {
                      const answer = answers.find((item) => item.questionId === question.id);
                      return <div key={question.id} className="flex items-start justify-between gap-3 py-3">
                        <div className="min-w-0"><dt className="text-sm leading-6 text-slate-500">{question.label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-900">{answer ? answerLabel(question, answer.value) : question.required ? "ยังไม่ได้ตอบ" : "ไม่ได้ระบุ (ไม่บังคับ)"}</dd></div>
                        <button type="button" aria-label={`แก้ไข ${question.label}`} className={`atlas-interactive ${focus} shrink-0 rounded-[var(--radius-control)] border border-[var(--color-action-primary)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-action-primary)] hover:bg-[var(--color-brand-primary-soft)]`} onClick={() => { setEditing(true); setGroupId(question.groupId); setShowErrors(false); }}>แก้ไข</button>
                      </div>;
                    })}
                  </dl>
                </section>;
              })}
            </div>
            <FlowActions back={<FlowBack onClick={back} />} forward={<FlowForward type="button" disabled={!complete} onClick={finish}>ยืนยันคำตอบและดูผลประเมิน</FlowForward>} />
          </section>
        ) : (
          <form ref={form} onSubmit={continueGroup} noValidate>
            <div className="rounded-[var(--radius-surface)] border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] p-4 shadow-[var(--shadow-tactile-sm)]" role="status">
              <div className="h-2 overflow-hidden rounded-full atlas-progress-track"><div className="atlas-progress-fill h-full rounded-full" style={{ width: `${progress.percentage}%` }} /></div>
              <p className="mt-3 text-xs font-semibold text-[var(--color-action-primary)]">ส่วนที่ {sectionIndex + 1} จาก {definition.sections.length} · กลุ่มคำถาม {progress.groupIndex + 1} จาก {groupIds.length} ที่เกี่ยวข้อง</p>
            </div>
            <h2 ref={heading} tabIndex={-1} className={`mt-2 text-2xl font-semibold text-slate-900 ${focus}`}>{definition.sections[sectionIndex]?.label}</h2>
            <p className="mt-2 text-xs text-slate-500">คำถามถัดไปปรับตามคำตอบของคุณ เลือก “ไม่ทราบ” ได้เมื่อไม่แน่ใจ</p>
            <div className="my-6 space-y-5">
              {group.map((question) => <AssessmentField key={question.id} question={question} value={answers.find((answer) => answer.questionId === question.id)?.value} showErrors={showErrors} onChange={(value) => changeAnswer(question, value)} />)}
            </div>
            <FlowActions back={<FlowBack onClick={back} />} forward={<FlowForward type="submit">{editing ? "บันทึกและกลับไปตรวจสอบ" : "ดำเนินการต่อ"}</FlowForward>} />
          </form>
        )}
      </div>
    </AppShell>
  );
}

function AssessmentField({ question, value, showErrors, onChange }: {
  question: AssessmentQuestion; value?: AssessmentValue; showErrors: boolean;
  onChange: (value: AssessmentValue | undefined) => void;
}) {
  const [numberText, setNumberText] = useState(value?.kind === "number" ? String(value.value) : "");
  const [numberTouched, setNumberTouched] = useState(false);
  const numericInvalid = question.type === "number" && numberTouched && numberText !== "" &&
    !parseNumericDraft(question, numberText).valid;
  const error = numericInvalid ? "กรุณากรอกจำนวนเต็มตั้งแต่ 0 ถึง 100" : showErrors ? answerError(question, value) : null;
  const helpId = `help-${question.id}`;
  const errorId = `error-${question.id}`;
  const describedBy = `${helpId}${error ? ` ${errorId}` : ""}`;
  return <fieldset id={`field-${question.id}`} className="min-w-0 rounded-[var(--radius-surface)] border border-[var(--color-border-strong)] bg-white p-4 shadow-[var(--shadow-tactile-sm)] sm:p-5" aria-describedby={describedBy}>
    <legend className="max-w-full px-1 text-base font-semibold leading-7 text-slate-900">{question.label}{!question.required ? <span className="ml-2 text-xs font-normal text-slate-500">ไม่บังคับ</span> : null}</legend>
    <p id={helpId} className="mb-3 text-xs leading-5 text-slate-500">{question.help}</p>
    {question.type === "number" ? (
      <>
        <label className="block text-sm text-slate-700">
          {question.label}
          <span className="mt-2 flex items-center gap-3">
            <input type="text" inputMode="numeric" autoComplete="off" value={numberText} aria-invalid={Boolean(error)} aria-describedby={describedBy}
              className={`atlas-focus min-w-0 flex-1 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-4 py-3 text-base aria-invalid:border-rose-500`}
              onChange={(event) => {
                const text = event.target.value;
                setNumberText(text); setNumberTouched(true);
                const draft = parseNumericDraft(question, text);
                if (draft.valid) onChange(draft.value);
              }} />
            <span>{question.unit}</span>
          </span>
        </label>
        {question.allowUnknown ? <label className="mt-4 flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" checked={value?.kind === "unknown" && numberText === ""} className={`h-5 w-5 accent-[var(--color-brand-primary)] ${focus}`}
            onChange={(event) => { setNumberText(""); setNumberTouched(false); onChange(event.target.checked ? { kind: "unknown" } : undefined); }} />ไม่ทราบ
        </label> : null}
      </>
    ) : (
      <div className="grid gap-2 sm:grid-cols-2">
        {question.options.map((option) => {
          const checked = value?.kind === "choice" ? value.optionId === option.id : value?.kind === "multi" && value.optionIds.includes(option.id);
          return <label key={option.id} className={`group block cursor-pointer ${question.type === "multi" ? "" : ""}`}>
            <input type={question.type === "multi" ? "checkbox" : "radio"} name={question.id} value={option.id} checked={Boolean(checked)} aria-invalid={Boolean(error)} aria-describedby={describedBy}
              className="peer sr-only"
              onChange={() => {
                if (question.type !== "multi") { onChange({ kind: "choice", optionId: option.id }); return; }
                const selected = value?.kind === "multi" ? value.optionIds : [];
                const exclusive = question.options.find((item) => item.id === option.id)?.exclusive;
                const next = checked ? selected.filter((id) => id !== option.id) : exclusive ? [option.id]
                  : [...selected.filter((id) => !question.options.find((item) => item.id === id)?.exclusive), option.id];
                onChange(next.length ? { kind: "multi", optionIds: next } : undefined);
              }} />
            <span className={`atlas-interactive block min-h-12 rounded-[var(--radius-control)] border px-4 py-3 text-sm font-medium leading-6 text-[var(--color-foreground)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-focus)] peer-focus-visible:ring-4 peer-focus-visible:ring-[var(--color-focus-ring)] ${checked ? "border-[var(--color-action-primary)] bg-[var(--color-brand-primary-soft)]" : "border-[var(--color-border-strong)] bg-white"}`}>{option.label}</span>
          </label>;
        })}
      </div>
    )}
    {error ? <p id={errorId} role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : null}
  </fieldset>;
}
