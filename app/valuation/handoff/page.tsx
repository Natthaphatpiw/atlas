"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { MockAnalyticsService } from "@/adapters/mock/analytics";
import { MockValuationService } from "@/adapters/mock/valuation";
import { AppShell } from "@/components/app-shell";
import { hasReachedStage, markHandoffReady, type StoredValuationSession } from "@/lib/valuation-session";
import type { MockValuationResult } from "@/services/valuation-service";

const valuationService = new MockValuationService();
const analyticsService = new MockAnalyticsService();
const noSessionSubscription = () => () => undefined;
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

export default function HandoffPage() {
  const router = useRouter();
  const raw = useSyncExternalStore(noSessionSubscription, getStoredSessionRaw, () => null);
  const storedSession = useMemo(() => parseStoredSession(raw), [raw]);
  const [mockResult, setMockResult] = useState<MockValuationResult | null>(null);
  const [contextError, setContextError] = useState(false);
  const [placeholderVisible, setPlaceholderVisible] = useState(false);
  const trackedSessionRef = useRef<string | null>(null);

  const hasDevice = Boolean(storedSession?.device && storedSession?.session?.deviceId);
  const hasCondition = Boolean(storedSession?.session?.conditionAnswers?.length) &&
    hasReachedStage(storedSession?.session?.status, "condition_completed");
  const expectedAmount = storedSession?.session?.expectedPrice?.amount;
  const hasExpectedPrice = typeof expectedAmount === "number" && Number.isFinite(expectedAmount) && expectedAmount > 0 &&
    hasReachedStage(storedSession?.session?.status, "expected_price_entered");
  const hasPrerequisites = hasDevice && hasCondition && hasExpectedPrice &&
    hasReachedStage(storedSession?.session?.status, "lead_collected");

  useEffect(() => {
    if (!storedSession || !hasPrerequisites) return;
    let active = true;

    void valuationService.getMockValuationResult(storedSession.session).then((result) => {
      if (!active) return;
      if (!markHandoffReady(storedSession.session.id)) {
        throw new Error("Valuation session is no longer available");
      }
      setMockResult(result);
      if (trackedSessionRef.current !== storedSession.session.id) {
        trackedSessionRef.current = storedSession.session.id;
        analyticsService.track({
          eventName: "handoff_started",
          sessionId: storedSession.session.id,
          route: "/valuation/handoff",
          deviceCategory: storedSession.device.category,
          deviceId: storedSession.device.id,
          timestamp: new Date().toISOString(),
        });
      }
    }).catch(() => {
      if (active) setContextError(true);
    });

    return () => { active = false; };
  }, [hasPrerequisites, storedSession]);

  const recoveryRoute = !hasDevice ? "/valuation/device"
    : !hasCondition ? "/valuation/condition"
      : !hasExpectedPrice ? "/valuation/expected-price" : "/valuation/lead";
  const recoveryLabel = !hasDevice ? "เลือกสินค้า"
    : !hasCondition ? "ตอบคำถามสภาพ"
      : !hasExpectedPrice ? "ระบุราคาที่ต้องการ" : "กรอกข้อมูลติดต่อ";

  return (
    <AppShell
      title="ดำเนินการต่อผ่าน LINE"
      description="ขั้นตอนถัดไปสามารถดำเนินการต่อผ่าน LINE ของ Atlast"
      compactHeader
      backAction={
        <button type="button" onClick={() => router.push("/valuation/lead")} aria-label="ย้อนกลับ"
          className={`rounded-full p-1 text-xl text-slate-700 hover:bg-slate-100 ${focusClass}`}>
          ←
        </button>
      }
    >
      <div className="mx-auto max-w-[820px]">
        {!hasPrerequisites ? (
          <div className="rounded-3xl bg-white px-5 py-10 text-center">
            <h2 className="text-xl font-semibold text-slate-900">ยังส่งข้อมูลไม่ครบ</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">ประเมินสินค้าและส่งข้อมูลติดต่อให้เรียบร้อยก่อนดำเนินการต่อ</p>
            <button type="button" onClick={() => router.push(recoveryRoute)}
              className={`mt-6 rounded-full bg-[var(--color-brand-primary)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-primary-hover)] ${focusClass}`}>
              {recoveryLabel}
            </button>
          </div>
        ) : contextError ? (
          <div role="alert" className="py-10 text-center">
            <p className="text-sm text-slate-600">ยังเตรียมข้อมูลไม่ได้ กรุณากลับไปที่ข้อมูลติดต่อแล้วลองอีกครั้ง</p>
            <button type="button" onClick={() => router.push("/valuation/lead")}
              className={`mt-4 rounded-full px-5 py-3 font-medium text-[var(--color-brand-primary-hover)] ${focusClass}`}>
              กลับไปที่ข้อมูลติดต่อ
            </button>
          </div>
        ) : !mockResult || !storedSession ? (
          <p role="status" className="py-10 text-center text-sm text-slate-500">กำลังเตรียมข้อมูล...</p>
        ) : (
          <div className="mx-auto max-w-[640px]">
            <p className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-600">
              <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-hover)]">✓</span>
              ส่งข้อมูลเรียบร้อยแล้ว
            </p>
            <section aria-label="สรุปการประเมิน" className="rounded-xl bg-[var(--color-surface-subtle)] px-3 py-3 sm:flex sm:items-center sm:justify-between sm:gap-6">
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
            <button type="button" onClick={() => setPlaceholderVisible(true)}
              aria-describedby={placeholderVisible ? "line-placeholder-message" : undefined}
              className={`mt-7 flex min-h-14 w-full items-center justify-center rounded-full bg-[var(--color-brand-primary)] px-5 py-3.5 text-base font-semibold text-white shadow-[0_8px_20px_rgba(7,192,97,0.18)] transition-colors hover:bg-[var(--color-brand-primary-hover)] ${focusClass}`}>
              ดำเนินการต่อผ่าน LINE →
            </button>
            <div role="status" aria-live="polite" className="mt-3 min-h-12 text-center text-sm leading-6 text-slate-500">
              {placeholderVisible ? <p id="line-placeholder-message">การเชื่อมต่อ LINE จะพร้อมใช้งานเมื่อเปิดระบบจริง</p> : null}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
