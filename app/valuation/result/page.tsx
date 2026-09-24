"use client";

import { useEffect, useMemo, useSyncExternalStore, useState } from "react";
import { useRouter } from "next/navigation";
import { MockAnalyticsService } from "@/adapters/mock/analytics";
import { MockValuationService } from "@/adapters/mock/valuation";
import { AppShell } from "@/components/app-shell";
import type { Device } from "@/domain/types";
import { type MockValuationResult } from "@/services/valuation-service";
import { hasCompletedAssessment, markPreliminaryValuationAvailable, type StoredValuationSession } from "@/lib/valuation-session";

const valuationProgress = ["สินค้า", "สภาพ", "ราคา", "ข้อมูลติดต่อ"];
const storageKey = "atlast.valuation.session";
const valuationService = new MockValuationService();
const analyticsService = new MockAnalyticsService();
const noSessionSubscription = () => () => undefined;

function getStoredSessionRaw() {
  return typeof window === "undefined" ? null : window.sessionStorage.getItem(storageKey);
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

export default function ResultPage() {
  const router = useRouter();
  const storedSessionRaw = useSyncExternalStore(noSessionSubscription, getStoredSessionRaw, () => null);
  const storedSession = useMemo(() => parseStoredSession(storedSessionRaw), [storedSessionRaw]);
  const [mockResult, setMockResult] = useState<MockValuationResult | null>(null);

  const hasPrerequisites = Boolean(storedSession?.device && hasCompletedAssessment(storedSession));

  useEffect(() => {
    if (!storedSession || !hasPrerequisites) {
      return;
    }

    void valuationService.getMockValuationResult(storedSession.session).then((nextResult) => {
      if (!markPreliminaryValuationAvailable(nextResult)) return;
      setMockResult(nextResult);
      analyticsService.track({
        eventName: "valuation_result_viewed",
        sessionId: storedSession.session.id,
        route: "/valuation/result",
        deviceCategory: storedSession.device.category,
        deviceId: storedSession.device.id,
        timestamp: new Date().toISOString(),
      });
    });
  }, [hasPrerequisites, storedSession]);

  const handleContinue = () => {
    if (!storedSession || !mockResult || !markPreliminaryValuationAvailable(mockResult)) {
      return;
    }

    analyticsService.track({
      eventName: "seller_proceeded",
      sessionId: storedSession.session.id,
      route: "/valuation/result",
      deviceCategory: storedSession.device.category,
      deviceId: storedSession.device.id,
      timestamp: new Date().toISOString(),
    });
    router.push("/valuation/expected-price");
  };

  const handleBack = () => {
    router.push("/valuation/condition");
  };

  return (
    <AppShell
      title="ผลประเมินเบื้องต้น"
      description="ประเมินจากข้อมูลสินค้าและสภาพที่คุณระบุ"
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
        <ValuationProgress />

        {!storedSession ? (
          <MissingContext
            title="ยังไม่มีข้อมูลการประเมิน"
            description="กลับไปเลือกสินค้าเพื่อเริ่มต้นการประเมิน"
            actionLabel="เลือกสินค้า"
            onAction={() => router.push("/valuation/device")}
          />
        ) : !hasPrerequisites ? (
          <MissingContext
            title="ยังไม่มีข้อมูลครบสำหรับผลประเมิน"
            description="ตอบคำถามเกี่ยวกับสภาพสินค้าให้ครบก่อนดูผลประเมินเบื้องต้น"
            actionLabel="ตอบคำถามสภาพ"
            onAction={() => router.push("/valuation/condition")}
          />
        ) : !mockResult ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">กำลังเตรียมผลประเมิน...</div>
        ) : (
          <ResultContent
            storedSession={storedSession}
            mockResult={mockResult}
            onContinue={handleContinue}
          />
        )}
      </div>
    </AppShell>
  );
}

function ResultContent({
  storedSession,
  mockResult,
  onContinue,
}: {
  storedSession: StoredValuationSession;
  mockResult: MockValuationResult;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="mb-5 rounded-xl bg-[var(--color-surface-subtle)] px-4 py-2.5">
        <p className="text-base font-semibold text-slate-900">{storedSession.device.model}</p>
        <p className="mt-0.5 text-sm text-slate-600">{formatDeviceSpecs(storedSession.device)}</p>
      </div>

      <section className="border-y border-[var(--color-border-soft)] py-7 text-center sm:py-8">
        <p className="text-sm font-medium text-[var(--color-brand-primary-hover)]">ราคาประเมินเบื้องต้น</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl" aria-label={formatPriceRange(mockResult)}>
          {formatPriceRange(mockResult)}
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
          ราคานี้เป็นการประเมินเบื้องต้น<br />
          ราคาสุดท้ายจะยืนยันหลังตรวจสอบสินค้าจริง
        </p>
      </section>

      <div className="mt-5">
        <button
          type="button"
          onClick={onContinue}
          className="flex w-full items-center justify-center rounded-full bg-[var(--color-action-primary)] px-5 py-3.5 text-base font-semibold text-white shadow-[0_8px_20px_rgba(7,192,97,0.18)] transition-colors hover:bg-[var(--color-action-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
        >
          ระบุราคาที่ต้องการ →
        </button>
      </div>
    </>
  );
}

function ValuationProgress() {
  return (
    <div className="mb-8 flex items-center gap-2" aria-label="ความคืบหน้าการประเมินราคา">
      {valuationProgress.map((step, index) => (
        <div key={step} className="flex min-w-0 flex-1 items-center gap-2">
          <div
            className={[
              "h-1.5 flex-1 rounded-full",
              index <= 2 ? "bg-[var(--color-brand-primary)]" : "bg-slate-200",
            ].join(" ")}
          />
          <span
            className={[
              "hidden whitespace-nowrap text-xs sm:block",
              index === 2 ? "font-semibold text-slate-900" : index < 2 ? "text-[var(--color-brand-primary-hover)]" : "text-slate-400",
            ].join(" ")}
          >
            {step}
          </span>
        </div>
      ))}
    </div>
  );
}

function MissingContext({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-3xl bg-white px-5 py-10 text-center">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-6 rounded-full bg-[var(--color-action-primary)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--color-action-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function formatPriceRange(result: MockValuationResult) {
  return `฿${formatNumber(result.minPrice)} – ฿${formatNumber(result.maxPrice)}`;
}

function formatNumber(amount: number) {
  return amount.toLocaleString("en-US");
}

function formatDeviceSpecs(device: Device) {
  return Array.from(new Set([device.variant, ...Object.values(device.specs)].filter(Boolean))).join(" · ");
}
