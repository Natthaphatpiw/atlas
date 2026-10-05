"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFlowRouter } from "@/lib/flow-navigation";
import { EstimateRequestError, fetchEstimate, startEstimate } from "@/adapters/astly/estimate-client";
import { MockAnalyticsService } from "@/adapters/mock/analytics";
import { AppShell } from "@/components/app-shell";
import { FlowActions, FlowBack, FlowForward } from "@/components/flow-actions";
import { navigateForward } from "@/lib/forward-navigation";
import { Button } from "@/components/ui-primitives";
import type { AstlyValuation } from "@/domain/astly";
import type { Device } from "@/domain/types";
import { estimateRequestBody } from "@/lib/estimate-request-body";
import { usedMarketPrice } from "@/lib/used-price";
import { formatBaht, formatDeviceSpecs } from "@/lib/valuation-format";
import {
  clearEstimateJob,
  currentAstlyValuation,
  currentEstimateJob,
  estimateRequestKey,
  hasCompletedAssessment,
  hasReachedStage,
  markPreliminaryValuationAvailable,
  readValuationSession,
  saveEstimateJob,
  type StoredValuationSession,
} from "@/lib/valuation-session";

const storageKey = "atlast.valuation.session";
const analyticsService = new MockAnalyticsService();
const noSessionSubscription = () => () => undefined;
// Astly's pipeline normally answers in 30–90 s; past this the job is treated as lost.
const MAX_WAIT_MS = 6 * 60 * 1000;

// While estimating, the seller sees only a loading indicator: Astly's job
// status and internal steps stay out of the UI.
type Phase =
  | { kind: "estimating" }
  | { kind: "ready"; valuation: AstlyValuation }
  | { kind: "failed"; message: string; code: string; retryAfterSeconds?: number; canRetry: boolean };

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

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { window.clearTimeout(timer); reject(signal.reason); }, { once: true });
  });
}

const noOfferMessage = "จากสภาพเครื่องที่ระบุ ระบบยังเสนอราคาให้ไม่ได้ ลองตรวจสอบคำตอบเรื่องสภาพเครื่องอีกครั้ง";

const failed = (message: string, code: string, canRetry = true, retryAfterSeconds?: number): Extract<Phase, { kind: "failed" }> =>
  ({ kind: "failed", message, code, canRetry, retryAfterSeconds });

export default function ResultPage() {
  const router = useFlowRouter();
  const storedSessionRaw = useSyncExternalStore(noSessionSubscription, getStoredSessionRaw, () => null);
  const storedSession = useMemo(() => parseStoredSession(storedSessionRaw), [storedSessionRaw]);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [attempt, setAttempt] = useState(0);
  const viewedJobId = useRef<string | null>(null);

  const hasPrerequisites = Boolean(storedSession?.device && hasCompletedAssessment(storedSession));
  // Saving job progress rewrites the session; key the estimate on what it prices instead.
  const requestKey = storedSession && hasPrerequisites ? estimateRequestKey(storedSession) : null;

  useEffect(() => {
    if (!requestKey) return;
    const controller = new AbortController();

    const run = async () => {
      const stored = readValuationSession();
      if (!stored || estimateRequestKey(stored) !== requestKey) return;
      const existing = currentAstlyValuation(stored);
      if (existing) {
        // A submitted request keeps the price it was submitted with.
        if (stored.session.request) {
          setPhase({ kind: "ready", valuation: existing });
          return;
        }
        const shown = usedMarketPrice(existing.result);
        if (shown <= 0) {
          setPhase(failed(noOfferMessage, "no_offer", false));
          return;
        }
        // An edit that Astly does not price keeps the valuation but resets the
        // step. A valuation saved before prices were shown as used-market
        // prices is brought up to date the same way.
        const saved = stored.session.preliminaryValuation!;
        if ((!hasReachedStage(stored.session.status, "preliminary_valuation_available") || saved.minPrice !== shown) &&
            !markPreliminaryValuationAvailable({ ...saved, minPrice: shown, maxPrice: shown })) {
          setPhase(failed("บันทึกผลประเมินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", "session_unavailable"));
          return;
        }
        setPhase({ kind: "ready", valuation: existing });
        return;
      }
      if (stored.session.request) {
        setPhase(failed("คำขอนี้ส่งแล้วจากการประเมินครั้งก่อน เริ่มประเมินใหม่ได้จากหน้าสรุปคำขอ", "request_submitted", false));
        return;
      }

      let job = currentEstimateJob(stored);
      if (!job) {
        setPhase({ kind: "estimating" });
        const accepted = await startEstimate(requestKey, estimateRequestBody(stored.device, stored.session.assessment!));
        // Save before the unmount check: Astly has already accepted (and counted) this job.
        job = saveEstimateJob(accepted, requestKey)?.session.estimateJob ?? null;
        if (controller.signal.aborted) return;
        if (!job) {
          setPhase(failed("บันทึกความคืบหน้าการประเมินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", "session_unavailable"));
          return;
        }
        await wait(accepted.pollAfterMs, controller.signal);
      }

      const startedAt = Date.parse(job.startedAt);
      setPhase({ kind: "estimating" });
      for (;;) {
        const state = await fetchEstimate(job.jobId, job.ticket, controller.signal);
        if (controller.signal.aborted) return;

        if (state.status === "COMPLETED" && state.result) {
          const result = state.result;
          const shown = usedMarketPrice(result);
          if (shown <= 0) {
            // Keep the job: revisiting re-reads this outcome instead of paying again.
            setPhase(failed(noOfferMessage, "no_offer", false));
            return;
          }
          const valuation: AstlyValuation = {
            jobId: job.jobId, ticket: job.ticket, priceReceipt: state.priceReceipt, requestKey, condition: job.condition, result,
          };
          const saved = markPreliminaryValuationAvailable({
            minPrice: shown,
            maxPrice: shown,
            currency: "THB",
            source: "astly",
            astly: valuation,
          });
          if (!saved) {
            setPhase(failed("บันทึกผลประเมินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", "session_unavailable"));
            return;
          }
          analyticsService.track({
            eventName: "valuation_calculated",
            sessionId: saved.session.id,
            route: "/valuation/result",
            deviceCategory: saved.device.category,
            deviceId: saved.device.id,
            estimatedAmount: shown,
            confidence: result.confidence,
            timestamp: new Date().toISOString(),
          });
          setPhase({ kind: "ready", valuation });
          return;
        }
        if (state.status === "FAILED" || state.status === "CANCELLED") {
          clearEstimateJob();
          const code = state.code ?? "estimate_failed";
          setPhase(failed(state.error ?? "ประเมินราคาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", code, code !== "demo_estimate_unavailable"));
          return;
        }
        if (Date.now() - startedAt > MAX_WAIT_MS) {
          clearEstimateJob();
          setPhase(failed("การประเมินใช้เวลานานกว่าปกติ กรุณาลองใหม่อีกครั้ง", "timeout"));
          return;
        }
        await wait(state.pollAfterMs, controller.signal);
      }
    };

    run().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof EstimateRequestError) {
        if (error.code === "job_not_found") clearEstimateJob();
        const canRetry = !["invalid_request", "unsupported_device"].includes(error.code);
        setPhase(failed(error.message, error.code, canRetry, error.retryAfterSeconds));
        return;
      }
      setPhase(failed("ระบบประเมินราคาไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้ง", "estimate_unavailable"));
    });
    return () => controller.abort();
  }, [requestKey, attempt]);

  const reportedFailure = useRef<string | null>(null);
  useEffect(() => {
    if (phase?.kind !== "failed" || !storedSession || reportedFailure.current === `${attempt}:${phase.code}`) return;
    reportedFailure.current = `${attempt}:${phase.code}`;
    analyticsService.track({
      eventName: "valuation_failed",
      sessionId: storedSession.session.id,
      route: "/valuation/result",
      deviceCategory: storedSession.device.category,
      deviceId: storedSession.device.id,
      reason: phase.code,
      timestamp: new Date().toISOString(),
    });
  }, [phase, storedSession, attempt]);

  useEffect(() => {
    if (phase?.kind !== "ready" || !storedSession || viewedJobId.current === phase.valuation.jobId) return;
    viewedJobId.current = phase.valuation.jobId;
    analyticsService.track({
      eventName: "valuation_result_viewed",
      sessionId: storedSession.session.id,
      route: "/valuation/result",
      deviceCategory: storedSession.device.category,
      deviceId: storedSession.device.id,
      timestamp: new Date().toISOString(),
    });
  }, [phase, storedSession]);

  const handleContinue = () => {
    const stored = readValuationSession();
    if (!stored || !currentAstlyValuation(stored)) {
      return;
    }

    analyticsService.track({
      eventName: "seller_proceeded",
      sessionId: stored.session.id,
      route: "/valuation/result",
      deviceCategory: stored.device.category,
      deviceId: stored.device.id,
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
        ) : !requestKey ? (
          <FailedContent phase={failed("ระบบยังประเมินราคาสินค้าประเภทนี้ไม่ได้", "unsupported_device", false)} onRetry={() => undefined} onBack={handleBack} />
        ) : !phase || phase.kind === "estimating" ? (
          <EstimatingContent device={storedSession.device} />
        ) : phase.kind === "failed" ? (
          <FailedContent phase={phase} onRetry={() => { setPhase(null); setAttempt((value) => value + 1); }} onBack={handleBack} />
        ) : (
          <ResultContent
            device={storedSession.device}
            valuation={phase.valuation}
            onContinue={handleContinue}
            onBack={handleBack}
          />
        )}
      </div>
    </AppShell>
  );
}

function DeviceSummary({ device }: { device: Device }) {
  return (
    <div className="atlas-flow-panel-muted atlas-reveal mb-4 px-5 py-4">
      <p className="text-base font-semibold text-slate-900">{device.model}</p>
      <p className="mt-0.5 text-sm text-slate-600">{formatDeviceSpecs(device)}</p>
    </div>
  );
}

function EstimatingContent({ device }: { device: Device }) {
  return (
    <>
      <DeviceSummary device={device} />
      <section className="atlas-flow-panel atlas-reveal atlas-reveal-delay-1 flex min-h-64 items-center justify-center p-10" role="status">
        <span
          aria-hidden="true"
          className="atlas-loader size-12 animate-spin rounded-full border-4 border-[var(--color-brand-primary-soft)] border-t-[var(--color-action-primary)]"
        />
        <span className="sr-only">กำลังประเมินราคา</span>
      </section>
    </>
  );
}

function FailedContent({ phase, onRetry, onBack }: { phase: Extract<Phase, { kind: "failed" }>; onRetry: () => void; onBack: () => void }) {
  const waitMinutes = phase.retryAfterSeconds ? Math.max(1, Math.ceil(phase.retryAfterSeconds / 60)) : null;
  return (
    <section className="atlas-flow-panel atlas-reveal p-7 text-center sm:p-10" role="alert">
      <h2 className="text-xl font-semibold text-[var(--color-foreground)]">ยังแสดงผลประเมินไม่ได้</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[var(--color-muted-foreground)]">{phase.message}</p>
      {waitMinutes ? <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">ลองใหม่ได้ในอีกประมาณ {waitMinutes} นาที</p> : null}
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Button tone="secondary" onClick={onBack}>แก้ไขข้อมูลสภาพเครื่อง</Button>
        {phase.canRetry ? <Button onClick={onRetry}>ลองประเมินอีกครั้ง</Button> : null}
      </div>
    </section>
  );
}

function ResultContent({
  device,
  valuation,
  onContinue,
  onBack,
}: {
  device: Device;
  valuation: AstlyValuation;
  onContinue: () => void;
  onBack: () => void;
}) {
  const price = usedMarketPrice(valuation.result);
  return (
    <>
      <DeviceSummary device={device} />

      <section className="atlas-flow-panel atlas-reveal atlas-reveal-delay-1 grid items-center gap-6 p-7 text-center sm:grid-cols-[1.2fr_0.8fr] sm:p-10 sm:text-left">
        <div>
          <p className="sr-only" role="status">ประเมินราคาเสร็จแล้ว ราคามือสองโดยประมาณ {formatBaht(price)}</p>
          <p className="text-sm font-medium text-[var(--color-action-primary)]">ราคามือสองโดยประมาณ</p>
          <p className="atlas-numeric mt-2 whitespace-nowrap text-[clamp(2.25rem,11vw,3rem)] font-semibold tracking-[-0.07em] text-[var(--color-foreground)] sm:text-6xl" aria-label={formatBaht(price)}>
            {formatBaht(price)}
          </p>
        </div>
        <p className="mx-auto max-w-md text-sm leading-7 text-[var(--color-muted-foreground)] sm:mx-0">ราคาตลาดมือสองของเครื่องรุ่นนี้ตามสภาพที่คุณระบุ เป็นการประเมินเบื้องต้น ราคาสุดท้ายจะยืนยันหลังตรวจสอบสินค้าจริง</p>
      </section>

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
