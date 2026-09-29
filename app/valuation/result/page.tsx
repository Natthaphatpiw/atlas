"use client";

import { useEffect, useMemo, useSyncExternalStore, useState } from "react";
import { useRouter } from "next/navigation";
import { MockAnalyticsService } from "@/adapters/mock/analytics";
import { MockValuationService } from "@/adapters/mock/valuation";
import { AppShell } from "@/components/app-shell";
import { FlowActions, FlowBack, FlowForward } from "@/components/flow-actions";
import { navigateForward } from "@/lib/forward-navigation";
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
    navigateForward(router, "/valuation/expected-price");
  };

  const handleBack = () => {
    router.push("/valuation/condition");
  };

  return (
    <AppShell
      title="ผลประเมินเบื้องต้น"
      description="ประเมินจากข้อมูลสินค้าและสภาพที่คุณระบุ"
      compactHeader
      contentSize="financial"
      flowStage="price"
      refined
      showHeaderBack={false}
    >
      <div className="mx-auto max-w-[980px]">
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
      <div className="atlas-flow-panel-muted atlas-reveal mb-4 px-5 py-4">
        <p className="text-base font-semibold text-slate-900">{storedSession.device.model}</p>
        <p className="mt-0.5 text-sm text-slate-600">{formatDeviceSpecs(storedSession.device)}</p>
      </div>

      <section className="atlas-flow-panel atlas-reveal atlas-reveal-delay-1 grid items-center gap-6 p-7 text-center sm:grid-cols-[1.2fr_0.8fr] sm:p-10 sm:text-left">
        <div>
        <p className="text-sm font-medium text-[var(--color-action-primary)]">ราคาประเมินเบื้องต้น</p>
        <p className="atlas-numeric mt-2 whitespace-nowrap text-[clamp(2.25rem,11vw,3rem)] font-semibold tracking-[-0.07em] text-[var(--color-foreground)] sm:text-6xl" aria-label={formatPriceRange(mockResult)}>
          {formatPriceRange(mockResult)}
        </p>
        </div><p className="mx-auto max-w-md text-sm leading-7 text-[var(--color-muted-foreground)] sm:mx-0">ราคานี้เป็นการประเมินเบื้องต้น ราคาสุดท้ายจะยืนยันหลังตรวจสอบสินค้าจริง</p></section>

      <div className="atlas-reveal atlas-reveal-delay-2 mt-5"><FlowActions back={<FlowBack onClick={onBack} />} forward={<FlowForward type="button" onClick={onContinue}>ระบุราคาที่ต้องการ</FlowForward>} /></div>
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
