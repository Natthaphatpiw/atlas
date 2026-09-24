"use client";

import { useEffect, useMemo, useSyncExternalStore, useState } from "react";
import { useRouter } from "next/navigation";
import { MockAnalyticsService } from "@/adapters/mock/analytics";
import { MockValuationService } from "@/adapters/mock/valuation";
import { AppShell } from "@/components/app-shell";
import { FlowActions, FlowBack, FlowForward } from "@/components/flow-actions";
import { Button } from "@/components/ui-primitives";
import type { Device } from "@/domain/types";
import { type MockValuationResult } from "@/services/valuation-service";
import { hasCompletedAssessment, markPreliminaryValuationAvailable, type StoredValuationSession } from "@/lib/valuation-session";

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
      flowStage="price"
      backAction={<span className="hidden" aria-hidden="true" />}
    >
      <div className="mx-auto max-w-[820px]">
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
            onBack={handleBack}
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
  onBack,
}: {
  storedSession: StoredValuationSession;
  mockResult: MockValuationResult;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <div className="mb-5 rounded-xl bg-[var(--color-surface-subtle)] px-4 py-2.5">
        <p className="text-base font-semibold text-slate-900">{storedSession.device.model}</p>
        <p className="mt-0.5 text-sm text-slate-600">{formatDeviceSpecs(storedSession.device)}</p>
      </div>

      <section className="border-y border-[var(--color-border-soft)] py-7 text-center sm:py-8">
        <p className="text-sm font-medium text-[var(--color-action-primary)]">ราคาประเมินเบื้องต้น</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl" aria-label={formatPriceRange(mockResult)}>
          {formatPriceRange(mockResult)}
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
          ราคานี้เป็นการประเมินเบื้องต้น<br />
          ราคาสุดท้ายจะยืนยันหลังตรวจสอบสินค้าจริง
        </p>
      </section>

      <div className="mt-5"><FlowActions back={<FlowBack onClick={onBack} />} forward={<FlowForward type="button" onClick={onContinue}>ระบุราคาที่ต้องการ</FlowForward>} /></div>
    </>
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
      <Button className="mt-6" onClick={onAction}>{actionLabel}</Button>
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
