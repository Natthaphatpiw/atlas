"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MockAnalyticsService } from "@/adapters/mock/analytics";
import { MockLeadService } from "@/adapters/mock/lead";
import { MockValuationService } from "@/adapters/mock/valuation";
import { AppShell } from "@/components/app-shell";
import { hasReachedStage, markLeadCollected, type StoredValuationSession } from "@/lib/valuation-session";
import type { LeadService } from "@/services/lead-service";
import type { MockValuationResult } from "@/services/valuation-service";

const leadService: LeadService = new MockLeadService();
const valuationService = new MockValuationService();
const analyticsService = new MockAnalyticsService();
const noSessionSubscription = () => () => undefined;
const inputClass = "mt-2 min-h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-brand-primary-glow)] aria-invalid:border-rose-400";
const focusClass = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]";

function getStoredSessionRaw() {
  return typeof window === "undefined" ? null : window.sessionStorage.getItem("atlast.valuation.session");
}

function parseStoredSession(raw: string | null): StoredValuationSession | null {
  try {
    return raw ? JSON.parse(raw) as StoredValuationSession : null;
  } catch {
    return null;
  }
}

export default function LeadPage() {
  const router = useRouter();
  const raw = useSyncExternalStore(noSessionSubscription, getStoredSessionRaw, () => null);
  const storedSession = useMemo(() => parseStoredSession(raw), [raw]);
  const [mockResult, setMockResult] = useState<MockValuationResult | null>(null);
  const [contextError, setContextError] = useState(false);
  const [incompleteCondition, setIncompleteCondition] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState({ name: false, phone: false, consent: false });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submittingRef = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);

  const hasDevice = Boolean(storedSession?.device && storedSession?.session?.deviceId);
  const hasCondition = Boolean(storedSession?.session?.conditionAnswers?.length) &&
    hasReachedStage(storedSession?.session?.status, "condition_completed");
  const expectedAmount = storedSession?.session?.expectedPrice?.amount;
  const hasPrerequisites = hasDevice && hasCondition &&
    typeof expectedAmount === "number" && Number.isFinite(expectedAmount) && expectedAmount > 0 &&
    hasReachedStage(storedSession?.session?.status, "expected_price_entered");

  useEffect(() => {
    if (!storedSession || !hasPrerequisites) return;
    let active = true;

    void Promise.all([
      valuationService.getMockValuationResult(storedSession.session),
      valuationService.getConditionQuestions(storedSession.device.category),
    ]).then(([result, questions]) => {
      if (!active) return;
      const complete = questions.length > 0 && questions.filter((question) => question.required !== false)
        .every((question) => storedSession.session.conditionAnswers.some((answer) =>
          answer.questionId === question.id && question.options.some((option) => option.label === answer.answer),
        ));
      setIncompleteCondition(!complete);
      setMockResult(complete ? result : null);
    }).catch(() => {
      if (active) setContextError(true);
    });

    return () => { active = false; };
  }, [hasPrerequisites, storedSession]);

  // Remove presentation separators only; preserve unexpected characters for validation.
  const normalizedPhone = phone.trim().replace(/[\s-]/g, "");
  const nameError = fullName.trim() ? "" : "กรุณาระบุชื่อ";
  const phoneError = !phone.trim() ? "กรุณาระบุเบอร์โทรศัพท์"
    : /^0\d{9}$/.test(normalizedPhone) ? "" : "กรุณาตรวจสอบเบอร์โทรศัพท์อีกครั้ง";
  const consentError = consent ? "" : "กรุณายินยอมให้ติดต่อกลับก่อนดำเนินการต่อ";
  const showNameError = (submitted || touched.name) && Boolean(nameError);
  const showPhoneError = (submitted || touched.phone) && Boolean(phoneError);
  const showConsentError = (submitted || touched.consent) && Boolean(consentError);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setSubmitted(true);
    setSubmitError("");
    if (nameError || phoneError || consentError) {
      (nameError ? nameRef : phoneError ? phoneRef : consentRef).current?.focus();
      return;
    }
    if (!storedSession || !hasPrerequisites || !mockResult || incompleteCondition) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await leadService.submitLead({
        sessionId: storedSession.session.id,
        fullName: fullName.trim(),
        phone: normalizedPhone,
        consentToContact: consent,
        source: "atlast_web",
      });
      if (!markLeadCollected(storedSession.session.id)) {
        throw new Error("Valuation session is no longer available");
      }
      analyticsService.track({
        eventName: "lead_submitted",
        sessionId: storedSession.session.id,
        route: "/valuation/lead",
        deviceCategory: storedSession.device.category,
        deviceId: storedSession.device.id,
        timestamp: new Date().toISOString(),
      });
      router.push("/valuation/handoff");
    } catch {
      setSubmitError("ยังส่งข้อมูลไม่ได้ กรุณาลองอีกครั้ง");
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const recoveryRoute = !hasDevice ? "/valuation/device"
    : !hasCondition || incompleteCondition ? "/valuation/condition" : "/valuation/expected-price";
  const recoveryLabel = !hasDevice ? "เลือกสินค้า"
    : !hasCondition || incompleteCondition ? "ตอบคำถามสภาพ" : "ระบุราคาที่ต้องการ";

  return (
    <AppShell
      title="ข้อมูลติดต่อ"
      description="กรอกข้อมูลเพื่อให้เราติดต่อกลับเกี่ยวกับการประเมินของคุณ"
      compactHeader
      backAction={
        <button type="button" onClick={() => router.push("/valuation/result")} disabled={isSubmitting}
          aria-label="ย้อนกลับ" className={`rounded-full p-1 text-xl text-slate-700 hover:bg-slate-100 disabled:opacity-50 ${focusClass}`}>
          ←
        </button>
      }
    >
      <div className="mx-auto max-w-[820px]">
        {!hasPrerequisites || incompleteCondition ? (
          <div className="rounded-3xl bg-white px-5 py-10 text-center">
            <h2 className="text-xl font-semibold text-slate-900">ยังไม่มีข้อมูลครบสำหรับติดต่อกลับ</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">ทำตามขั้นตอนสินค้า สภาพ และราคาที่ต้องการให้ครบก่อนกรอกข้อมูลติดต่อ</p>
            <button type="button" onClick={() => router.push(recoveryRoute)}
              className={`mt-6 rounded-full bg-[var(--color-brand-primary)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-primary-hover)] ${focusClass}`}>
              {recoveryLabel}
            </button>
          </div>
        ) : contextError ? (
          <div role="alert" className="py-10 text-center">
            <p className="text-sm text-slate-600">ยังโหลดข้อมูลการประเมินไม่ได้ กรุณากลับไปที่ผลประเมินแล้วลองอีกครั้ง</p>
            <button type="button" onClick={() => router.push("/valuation/result")}
              className={`mt-4 rounded-full px-5 py-3 font-medium text-[var(--color-brand-primary-hover)] ${focusClass}`}>
              กลับไปที่ผลประเมิน
            </button>
          </div>
        ) : !mockResult || !storedSession ? (
          <p role="status" className="py-10 text-center text-sm text-slate-500">กำลังเตรียมข้อมูลการประเมิน...</p>
        ) : (
          <>
            <p className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
              <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-hover)]">✓</span>
              ประเมินเบื้องต้นเรียบร้อยแล้ว
            </p>
            <section aria-label="สรุปการประเมิน" className="mb-6 rounded-xl bg-[var(--color-surface-subtle)] px-3 py-2.5 sm:flex sm:items-center sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-slate-700">{storedSession.device.model}</p>
                <p className="mt-0.5 break-words text-xs leading-5 text-slate-500">
                  {Array.from(new Set([storedSession.device.variant, ...Object.values(storedSession.device.specs)].filter(Boolean))).join(" · ")}
                </p>
              </div>
              <div className="mt-2 shrink-0 sm:mt-0 sm:text-right">
                <p className="text-xs text-slate-500">ราคาประเมินเบื้องต้น</p>
                <p className="mt-0.5 text-sm font-medium text-slate-600">
                  ฿{mockResult.minPrice.toLocaleString("en-US")} – ฿{mockResult.maxPrice.toLocaleString("en-US")}
                </p>
              </div>
            </section>

            <form noValidate onSubmit={handleSubmit} aria-busy={isSubmitting} className="mx-auto w-full max-w-[640px]">
              <fieldset disabled={isSubmitting} className="min-w-0 space-y-5">
                <legend className="sr-only">ข้อมูลติดต่อกลับ</legend>
                <div>
                  <label htmlFor="lead-name" className="text-sm font-medium text-slate-700">ชื่อ</label>
                  <input ref={nameRef} id="lead-name" name="name" type="text" autoComplete="name" required
                    value={fullName} onChange={(event) => setFullName(event.target.value)}
                    onBlur={() => setTouched((current) => ({ ...current, name: true }))}
                    aria-invalid={showNameError} aria-describedby={showNameError ? "lead-name-error" : undefined}
                    className={inputClass} />
                  {showNameError ? <p id="lead-name-error" aria-live="polite" className="mt-2 text-sm text-rose-700">{nameError}</p> : null}
                </div>
                <div>
                  <label htmlFor="lead-phone" className="text-sm font-medium text-slate-700">เบอร์โทรศัพท์</label>
                  <input ref={phoneRef} id="lead-phone" name="tel" type="tel" inputMode="tel" autoComplete="tel" required
                    placeholder="เช่น 081 234 5678" value={phone} onChange={(event) => setPhone(event.target.value)}
                    onBlur={() => setTouched((current) => ({ ...current, phone: true }))}
                    aria-invalid={showPhoneError} aria-describedby={showPhoneError ? "lead-phone-error" : undefined}
                    className={inputClass} />
                  {showPhoneError ? <p id="lead-phone-error" aria-live="polite" className="mt-2 text-sm text-rose-700">{phoneError}</p> : null}
                </div>
                <div className="pt-1">
                  <label htmlFor="lead-consent" className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm leading-6 text-slate-600">
                    <input ref={consentRef} id="lead-consent" name="consent" type="checkbox" required checked={consent}
                      onChange={(event) => { setConsent(event.target.checked); setTouched((current) => ({ ...current, consent: true })); }}
                      aria-invalid={showConsentError} aria-describedby={showConsentError ? "lead-consent-error" : undefined}
                      className={`mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-brand-primary)] ${focusClass}`} />
                    <span>ยินยอมให้ Atlast ติดต่อกลับเกี่ยวกับการประเมินสินค้านี้</span>
                  </label>
                  {showConsentError ? <p id="lead-consent-error" aria-live="polite" className="mt-1 text-sm text-rose-700">{consentError}</p> : null}
                </div>
              </fieldset>
              {submitError ? <p role="alert" className="mt-4 text-sm text-rose-700">{submitError}</p> : null}
              <button type="submit" disabled={isSubmitting}
                className={`mt-5 flex min-h-14 w-full items-center justify-center rounded-full bg-[var(--color-brand-primary)] px-5 py-3.5 text-base font-semibold text-white shadow-[0_8px_20px_rgba(7,192,97,0.18)] transition-colors hover:bg-[var(--color-brand-primary-hover)] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none ${focusClass}`}>
                {isSubmitting ? "กำลังส่งข้อมูล..." : "ส่งข้อมูลและดำเนินการต่อ →"}
              </button>
            </form>
          </>
        )}
      </div>
    </AppShell>
  );
}
