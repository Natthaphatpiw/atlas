"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { MockAnalyticsService } from "@/adapters/mock/analytics";
import { AppShell } from "@/components/app-shell";
import { FlowActions, FlowBack, FlowForward } from "@/components/flow-actions";
import { Button } from "@/components/ui-primitives";
import type { TransactionIntent } from "@/domain/types";
import { hasPreliminaryValuation, hasReachedStage, hasSubmittedRequest, updateTransactionIntent, type StoredValuationSession } from "@/lib/valuation-session";

const analytics = new MockAnalyticsService();
const noSubscription = () => () => undefined;
const getRaw = () => window.sessionStorage.getItem("atlast.valuation.session");
const options: Array<{ value: TransactionIntent; label: string; description: string }> = [
  {
    value: "outright_sale",
    label: "ต้องการขายขาด",
    description: "ขายอุปกรณ์ตามขั้นตอนของ Atlas โดยไม่มีขั้นตอนรับอุปกรณ์คืนในภายหลัง",
  },
  {
    value: "sell_and_repurchase",
    label: "ต้องการขายฝาก",
    description: "แสดงความสนใจในแนวทางที่อาจรับอุปกรณ์คืนภายหลัง โดยรายละเอียดจะต้องยืนยันในขั้นตอนถัดไป",
  },
];

export default function TransactionIntentPage() {
  const router = useRouter();
  const raw = useSyncExternalStore(noSubscription, getRaw, () => null);
  const stored = useMemo(() => {
    try { return raw ? JSON.parse(raw) as StoredValuationSession : null; } catch { return null; }
  }, [raw]);
  const [selectionOverride, setSelectionOverride] = useState<TransactionIntent | null>(null);
  const selected = selectionOverride ?? stored?.session.transactionIntent ?? null;
  const hasExpectedPrice = hasPreliminaryValuation(stored) &&
    Number.isSafeInteger(stored?.session.expectedPrice?.amount) && (stored?.session.expectedPrice?.amount ?? 0) > 0 &&
    hasReachedStage(stored?.session.status, "expected_price_entered");

  const handleContinue = () => {
    if (!selected || !stored || !updateTransactionIntent(selected)) return;
    analytics.track({
      eventName: "transaction_intent_selected",
      transactionIntent: selected,
      sessionId: stored.session.id,
      route: "/valuation/transaction-intent",
      deviceCategory: stored.device.category,
      deviceId: stored.device.id,
      timestamp: new Date().toISOString(),
    });
    router.push("/valuation/lead");
  };

  return (
    <AppShell
      title="รูปแบบการทำรายการ"
      description="เลือกความต้องการของคุณก่อนกรอกข้อมูลติดต่อ"
      compactHeader
      flowStage="price"
      backAction={<span className="hidden" aria-hidden="true" />}
    >
      <div className="mx-auto max-w-[820px]">
        {hasSubmittedRequest(stored) ? (
          <Recovery title="คำขอนี้ถูกส่งแล้ว" description="ไม่สามารถแก้ไขรูปแบบการทำรายการหลังส่งคำขอ" label="ดูคำขอที่ส่งแล้ว" onClick={() => router.push("/valuation/handoff")} />
        ) : !hasExpectedPrice ? (
          <Recovery title="ยังไม่มีข้อมูลราคาครบ" description="ดูผลประเมินและระบุราคาที่ต้องการก่อนเลือกรูปแบบการทำรายการ" label={hasPreliminaryValuation(stored) ? "ระบุราคาที่ต้องการ" : "ดูผลประเมิน"} onClick={() => router.push(hasPreliminaryValuation(stored) ? "/valuation/expected-price" : stored?.device ? "/valuation/result" : "/valuation/device")} />
        ) : (
          <section>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">คุณต้องการทำรายการแบบใด?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">เลือกหนึ่งรูปแบบเพื่อส่งพร้อมคำขอ ตัวเลือกขายฝากในขั้นตอนนี้เป็นเพียงความต้องการของผู้ขาย ยังไม่มีข้อกำหนด ค่าธรรมเนียม หรือสัญญา</p>
            <fieldset className="mt-6 grid gap-3 sm:grid-cols-2">
              <legend className="sr-only">รูปแบบการทำรายการ</legend>
              {options.map((option) => {
                const checked = selected === option.value;
                return (
                  <label key={option.value} className={`atlas-interactive block cursor-pointer rounded-[var(--radius-surface)] border p-5 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-focus)] ${checked ? "border-[var(--color-action-primary)] bg-[var(--color-brand-primary-soft)]" : "border-[var(--color-border-strong)] bg-white"}`}>
                    <span>
                      <input type="radio" name="transaction-intent" value={option.value} checked={checked}
                        onChange={() => setSelectionOverride(option.value)} className="peer sr-only" />
                      <span>
                        <span className="block font-semibold text-slate-900">{option.label}</span>
                        <span className="mt-2 block text-sm leading-6 text-slate-600">{option.description}</span>
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <div className="mt-6"><FlowActions back={<FlowBack onClick={() => router.push("/valuation/expected-price")} />} forward={<FlowForward type="button" disabled={!selected} onClick={handleContinue}>ดำเนินการต่อ</FlowForward>} /></div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function Recovery({ title, description, label, onClick }: { title: string; description: string; label: string; onClick: () => void }) {
  return <section className="rounded-3xl bg-white px-5 py-10 text-center">
    <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    <Button className="mt-6" onClick={onClick}>{label}</Button>
  </section>;
}
