"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MockAnalyticsService } from "@/adapters/mock/analytics";
import { MockRequestService } from "@/adapters/mock/request";
import { contactErrors, normalizeSellerContact } from "@/lib/seller-contact";
import { MockValuationService } from "@/adapters/mock/valuation";
import { assessmentComplete, isCurrentAssessment } from "@/lib/assessment";
import { AppShell } from "@/components/app-shell";
import { hasCompletedAssessment, hasRequestPrerequisites, markRequestSubmitted, type StoredValuationSession } from "@/lib/valuation-session";
import type { RequestService } from "@/services/request-service";
import type { MockValuationResult } from "@/services/valuation-service";

const requestService: RequestService = new MockRequestService();
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
  const [lineId, setLineId] = useState("");
  const viewed = useRef<string | null>(null);
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
  const hasCondition = hasCompletedAssessment(storedSession);
  const hasPrerequisites = hasRequestPrerequisites(storedSession);

  useEffect(() => {
    if (!storedSession || !hasPrerequisites) return;
    let active = true;

    void Promise.all([
      valuationService.getMockValuationResult(storedSession.session),
      valuationService.getDeviceAssessment(storedSession.device),
    ]).then(([result, definition]) => {
      if (!active) return;
      const assessment = storedSession.session.assessment;
      const complete = isCurrentAssessment(assessment, definition) &&
        assessmentComplete(definition, storedSession.device, assessment.answers);
      setIncompleteCondition(!complete);
      setMockResult(complete ? result : null);
    }).catch(() => {
      if (active) setContextError(true);
    });

    return () => { active = false; };
  }, [hasPrerequisites, storedSession]);

  const contact = normalizeSellerContact({ fullName, phone, lineIdProvided: lineId, consentToContact: consent });
  const { name: nameError, phone: phoneError, consent: consentError } = contactErrors(contact);
  useEffect(() => {
    if (!storedSession || !mockResult || !hasPrerequisites || viewed.current === storedSession.session.id) return;
    viewed.current = storedSession.session.id;
    analyticsService.track({ eventName: "seller_contact_viewed", sessionId: storedSession.session.id, route: "/valuation/lead", timestamp: new Date().toISOString() });
  }, [storedSession, mockResult, hasPrerequisites]);
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
      const receipt = await requestService.submitRequest({
        sessionId: storedSession.session.id,
        context: {
          device: storedSession.device,
          assessment: storedSession.session.assessment!,
          expectedPrice: storedSession.session.expectedPrice!,
          preliminaryValuation: mockResult,
        },
        contact,
        source: "atlast_web",
      });
      if (!markRequestSubmitted(receipt)) {
        throw new Error("Valuation context changed before submission completed");
      }
      analyticsService.track({
        eventName: "valuation_request_submitted",
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
      title="ข้อมูลติดต่อผู้ขาย"
      description="กรอกข้อมูลติดต่อก่อนส่งคำขอประเมินสินค้า แล้วจึงเชื่อมต่อ LINE ในขั้นตอนถัดไป"
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
              className={`mt-6 rounded-full bg-[var(--color-action-primary)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--color-action-primary-hover)] ${focusClass}`}>
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
            {storedSession.session.status === "lead_collected" || storedSession.session.status === "handoff_ready" ? <p role="status" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">สถานะเดิมยังไม่ใช่คำขอในต้นแบบฉบับนี้ กรุณากรอกข้อมูลติดต่อและส่งคำขอใหม่ ข้อมูลสินค้า สภาพ และราคายังอยู่</p> : null}
            <p className="mb-4 text-sm leading-6 text-slate-600">นี่คือต้นแบบการส่งคำขอ ยังไม่ส่งข้อมูลให้เจ้าหน้าที่หรือบันทึกบนเซิร์ฟเวอร์ ข้อมูลติดต่อใช้เฉพาะการทดลองครั้งนี้และไม่เก็บในเบราว์เซอร์หลังส่ง</p>
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
                <div>
                  <label htmlFor="lead-line-id" className="text-sm font-medium text-slate-700">LINE ID <span className="font-normal text-slate-500">(ไม่บังคับ)</span></label>
                  <input id="lead-line-id" name="lineIdProvided" type="text" autoComplete="off" value={lineId}
                    onChange={(event) => setLineId(event.target.value)} aria-describedby="lead-line-help" className={inputClass} />
                  <p id="lead-line-help" className="mt-2 text-xs leading-6 text-slate-500">ระบุเป็นข้อมูลติดต่อได้หากต้องการ ยังไม่ได้ยืนยันว่าเป็นบัญชีของคุณ และไม่ถือว่าเชื่อมต่อ LINE หรือเพิ่มเพื่อน Atlas แล้ว</p>
                </div>
                <div className="pt-1">
                  <label htmlFor="lead-consent" className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm leading-6 text-slate-600">
                    <input ref={consentRef} id="lead-consent" name="consent" type="checkbox" required checked={consent}
                      onChange={(event) => { setConsent(event.target.checked); setTouched((current) => ({ ...current, consent: true })); }}
                      aria-invalid={showConsentError} aria-describedby={showConsentError ? "lead-consent-error" : undefined}
                      className={`mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-brand-primary)] ${focusClass}`} />
                    <span>ยินยอมให้ Atlas ติดต่อกลับเกี่ยวกับการประเมินสินค้านี้</span>
                  </label>
                  {showConsentError ? <p id="lead-consent-error" aria-live="polite" className="mt-1 text-sm text-rose-700">{consentError}</p> : null}
                </div>
              </fieldset>
              {submitError ? <p role="alert" className="mt-4 text-sm text-rose-700">{submitError}</p> : null}
              <button type="submit" disabled={isSubmitting}
                className={`mt-5 flex min-h-14 w-full items-center justify-center rounded-full bg-[var(--color-action-primary)] px-5 py-3.5 text-base font-semibold text-white shadow-[0_8px_20px_rgba(7,192,97,0.18)] transition-colors hover:bg-[var(--color-action-primary-hover)] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none ${focusClass}`}>
                {isSubmitting ? "กำลังส่งคำขอ..." : "ส่งคำขอประเมินสินค้า →"}
              </button>
            </form>
          </>
        )}
      </div>
    </AppShell>
  );
}
