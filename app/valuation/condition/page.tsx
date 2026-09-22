"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { MockAnalyticsService } from "@/adapters/mock/analytics";
import { MockValuationService } from "@/adapters/mock/valuation";
import { AppShell } from "@/components/app-shell";
import type { ConditionAnswer, ConditionQuestion } from "@/domain/types";
import {
  updateConditionAnswers,
  type StoredValuationSession,
} from "@/lib/valuation-session";

const valuationProgress = ["สินค้า", "สภาพ", "ราคาที่ต้องการ", "ผลประเมิน"];
const valuationService = new MockValuationService();
const analyticsService = new MockAnalyticsService();
const noSessionSubscription = () => () => undefined;

function getStoredSessionRaw() {
  return typeof window === "undefined" ? null : window.sessionStorage.getItem("atlast.valuation.session");
}

function parseStoredSession(rawSession: string | null) {
  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as StoredValuationSession;
  } catch {
    return null;
  }
}

export default function ConditionPage() {
  const router = useRouter();
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  const storedSessionRaw = useSyncExternalStore(noSessionSubscription, getStoredSessionRaw, () => null);
  const storedSession = useMemo(() => parseStoredSession(storedSessionRaw), [storedSessionRaw]);
  const [questions, setQuestions] = useState<ConditionQuestion[] | null>(null);
  const [answerOverrides, setAnswerOverrides] = useState<Record<string, ConditionAnswer>>({});
  const [questionIndex, setQuestionIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!storedSession) {
      return;
    }

    void valuationService.getConditionQuestions(storedSession.device.category).then((nextQuestions) => {
      setQuestions(
        nextQuestions.filter(
          (question) =>
            !question.applicableCategories || question.applicableCategories.includes(storedSession.device.category),
        ),
      );
    });
  }, [storedSession]);

  const persistedAnswers = useMemo(
    () => Object.fromEntries((storedSession?.session.conditionAnswers ?? []).map((answer) => [answer.questionId, answer])),
    [storedSession],
  );
  const answers = useMemo(() => ({ ...persistedAnswers, ...answerOverrides }), [answerOverrides, persistedAnswers]);
  const initialQuestionIndex = useMemo(() => {
    if (!questions) {
      return 0;
    }

    const firstUnansweredIndex = questions.findIndex((question) => !persistedAnswers[question.id]);
    return firstUnansweredIndex === -1 ? questions.length : firstUnansweredIndex;
  }, [persistedAnswers, questions]);
  const activeQuestionIndex = questionIndex ?? initialQuestionIndex;
  const currentQuestion = questions?.[activeQuestionIndex];
  const isLoadingQuestions = Boolean(storedSession) && questions === null;
  const isComplete = Boolean(storedSession) && questions !== null && activeQuestionIndex >= questions.length;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  useEffect(() => {
    if (currentQuestion && !isLoadingQuestions) {
      questionHeadingRef.current?.focus();
    }
  }, [currentQuestion, isLoadingQuestions]);

  const orderedAnswers = useMemo(
    () => (questions ?? []).map((question) => answers[question.id]).filter(Boolean),
    [answers, questions],
  );

  const handleOptionSelect = (question: ConditionQuestion, option: ConditionQuestion["options"][number]) => {
    setAnswerOverrides((current) => ({
      ...current,
      [question.id]: {
        questionId: question.id,
        questionText: question.title ?? question.prompt,
        answer: option.label,
        normalizedScore: option.normalizedScore,
        weight: question.weight,
        answeredAt: new Date().toISOString(),
      },
    }));
  };

  const handleContinue = () => {
    if (!currentQuestion || !currentAnswer || !storedSession) {
      return;
    }

    const nextAnswers = { ...answers, [currentQuestion.id]: currentAnswer };
    const isLastQuestion = activeQuestionIndex === (questions?.length ?? 0) - 1;

    analyticsService.track({
      eventName: "condition_question_answered",
      route: "/valuation/condition",
      deviceCategory: storedSession.device.category,
      deviceId: storedSession.device.id,
      timestamp: new Date().toISOString(),
    });
    updateConditionAnswers(Object.values(nextAnswers), isLastQuestion ? "condition_completed" : "device_selected");

    if (isLastQuestion) {
      analyticsService.track({
        eventName: "condition_section_completed",
        route: "/valuation/condition",
        deviceCategory: storedSession.device.category,
        deviceId: storedSession.device.id,
        timestamp: new Date().toISOString(),
      });
    }

    setQuestionIndex((current) => (current ?? activeQuestionIndex) + 1);
  };

  const handleBack = () => {
    if (activeQuestionIndex > 0) {
      setQuestionIndex((current) => (current ?? activeQuestionIndex) - 1);
      return;
    }

    router.push("/valuation/device");
  };

  const handleEditAnswer = (index: number) => {
    setQuestionIndex(index);
  };

  const handleFinish = () => {
    if (storedSession) {
      updateConditionAnswers(orderedAnswers, "condition_completed");
    }
    router.push("/valuation/expected-price");
  };

  return (
    <AppShell
      title="สภาพอุปกรณ์"
      description="ตอบคำถามสั้น ๆ เกี่ยวกับสภาพสินค้าที่เลือก"
      compactHeader
      backAction={
        <button
          type="button"
          onClick={handleBack}
          aria-label="ย้อนกลับ"
          className="rounded-full p-1 text-xl text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
        >
          ←
        </button>
      }
    >
      <div className="mx-auto max-w-[820px]">
        <div className="mb-8 flex items-center gap-2" aria-label="ความคืบหน้าการประเมินราคา">
          {valuationProgress.map((step, index) => (
            <div key={step} className="flex min-w-0 flex-1 items-center gap-2">
              <div
                className={[
                  "h-1.5 flex-1 rounded-full",
                  index === 0 || index === 1 ? "bg-[var(--color-brand-primary)]" : "bg-slate-200",
                ].join(" ")}
              />
              <span
                className={[
                  "hidden whitespace-nowrap text-xs sm:block",
                  index === 1 ? "font-semibold text-slate-900" : index === 0 ? "text-[var(--color-brand-primary-hover)]" : "text-slate-400",
                ].join(" ")}
              >
                {step}
              </span>
            </div>
          ))}
        </div>

        {isLoadingQuestions ? (
          <div className="rounded-3xl bg-white px-5 py-12 text-center">
            <p className="text-sm text-slate-500">กำลังเตรียมคำถาม...</p>
          </div>
        ) : !storedSession ? (
          <div className="rounded-3xl bg-white px-5 py-10 text-center">
            <h2 className="text-xl font-semibold text-slate-900">ยังไม่มีสินค้าที่เลือก</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">กลับไปเลือกสินค้าก่อนเริ่มตอบคำถามเกี่ยวกับสภาพ</p>
            <button
              type="button"
              onClick={() => router.push("/valuation/device")}
              className="mt-6 rounded-full bg-[var(--color-action-primary)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--color-action-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
            >
              เลือกสินค้า
            </button>
          </div>
        ) : (
          <>
            <div className="mb-5 rounded-xl bg-[var(--color-surface-subtle)] px-4 py-2.5">
              <p className="text-base font-semibold text-slate-900">{storedSession.device.model}</p>
              <p className="mt-0.5 text-sm text-slate-600">{formatDeviceSpecs(storedSession.device)}</p>
            </div>

            {isComplete ? (
              <ConditionReview
                questions={questions}
                answers={orderedAnswers}
                onEdit={handleEditAnswer}
                onContinue={handleFinish}
              />
            ) : currentQuestion ? (
              <div>
                <div className="mb-5 flex items-center justify-between gap-4">
                  <p className="text-xs font-medium text-slate-500">
                    คำถาม {activeQuestionIndex + 1} จาก {questions.length}
                  </p>
                  <div className="flex-1" aria-hidden="true">
                    <div className="h-0.5 rounded-full bg-slate-200">
                      <div
                        className="h-0.5 rounded-full bg-[var(--color-brand-primary)] transition-[width] duration-300"
                        style={{ width: `${((activeQuestionIndex + 1) / questions.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <h2
                  ref={questionHeadingRef}
                  tabIndex={-1}
                  className="text-2xl font-semibold tracking-tight text-slate-900 outline-none sm:text-3xl"
                >
                  {currentQuestion.title ?? currentQuestion.prompt}
                </h2>
                {currentQuestion.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{currentQuestion.description}</p> : null}

                <div className="mt-6 space-y-3" role="radiogroup" aria-label={currentQuestion.title ?? currentQuestion.prompt}>
                  {currentQuestion.options.map((option, optionIndex) => {
                    const isSelected = currentAnswer?.answer === option.label;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={isSelected || (!currentAnswer && optionIndex === 0) ? 0 : -1}
                        onKeyDown={(event) => {
                          const direction = ["ArrowDown", "ArrowRight"].includes(event.key)
                            ? 1
                            : ["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 0;
                          if (!direction) return;
                          event.preventDefault();
                          const nextIndex = (optionIndex + direction + currentQuestion.options.length) % currentQuestion.options.length;
                          handleOptionSelect(currentQuestion, currentQuestion.options[nextIndex]);
                          const group = event.currentTarget.parentElement;
                          group?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
                        }}
                        onClick={() => handleOptionSelect(currentQuestion, option)}
                        className={[
                          "flex min-h-14 w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left text-base transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]",
                          isSelected
                            ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)] text-slate-900"
                            : "border-slate-200 bg-white text-slate-700 hover:border-[var(--color-brand-primary)]",
                        ].join(" ")}
                      >
                        <span>{option.label}</span>
                        {isSelected ? (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-sm text-white" aria-label="เลือกแล้ว">
                            ✓
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8">
                  <button
                    type="button"
                    onClick={handleContinue}
                    disabled={currentQuestion.required !== false && !currentAnswer}
                    className="flex w-full items-center justify-center rounded-full bg-[var(--color-action-primary)] px-5 py-3.5 text-base font-semibold text-white shadow-[0_8px_20px_rgba(7,192,97,0.18)] transition-colors hover:bg-[var(--color-action-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                  >
                    ดำเนินการต่อ →
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600">ยังไม่มีคำถามสำหรับอุปกรณ์ประเภทนี้</p>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function ConditionReview({
  questions,
  answers,
  onEdit,
  onContinue,
}: {
  questions: ConditionQuestion[];
  answers: ConditionAnswer[];
  onEdit: (index: number) => void;
  onContinue: () => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">ตรวจสอบคำตอบ</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">ตรวจสอบข้อมูลก่อนดำเนินการต่อ</p>
      <div className="mt-6 space-y-1">
        {answers.map((answer, index) => (
          <div key={answer.questionId} className="flex items-center justify-between gap-3 border-b border-slate-200 py-3">
            <div className="min-w-0">
              <p className="text-sm text-slate-500">{questions[index]?.title ?? answer.questionText}</p>
              <p className="mt-1 truncate font-medium text-slate-900">{answer.answer}</p>
            </div>
            <button
              type="button"
              onClick={() => onEdit(index)}
              className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-[var(--color-brand-primary-hover)] hover:bg-[var(--color-brand-primary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
            >
              แก้ไข
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onContinue}
        className="mt-8 flex w-full items-center justify-center rounded-full bg-[var(--color-action-primary)] px-5 py-3.5 text-base font-semibold text-white shadow-[0_8px_20px_rgba(7,192,97,0.18)] transition-colors hover:bg-[var(--color-action-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
      >
        ดำเนินการต่อ →
      </button>
    </div>
  );
}

function formatDeviceSpecs(device: StoredValuationSession["device"]) {
  return Array.from(new Set([device.variant, ...Object.values(device.specs)].filter(Boolean))).join(" · ");
}