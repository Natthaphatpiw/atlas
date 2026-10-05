"use client";

import { useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useFlowRouter } from "@/lib/flow-navigation";
import { MockAnalyticsService } from "@/adapters/mock/analytics";
import { AppShell } from "@/components/app-shell";
import { FlowActions, FlowBack, FlowForward } from "@/components/flow-actions";
import { navigateForward } from "@/lib/forward-navigation";
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
    description: "ได้เงินก่อน และซื้อเครื่องคืนได้ภายในเวลาที่ตกลงกัน",
  },
];

export default function TransactionIntentPage() {
  const router = useFlowRouter();
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
    navigateForward(router, "/valuation/lead");
  };

  return (
    <AppShell
      title="รูปแบบการทำรายการ"
      description="เลือกความต้องการของคุณก่อนกรอกข้อมูลติดต่อ"
      compactHeader
      contentSize="financial"
      flowStage="price"
      refined
      showHeaderBack={false}
    >
      <div className="mx-auto max-w-[920px]">
        {hasSubmittedRequest(stored) ? (
          <Recovery title="คำขอนี้ถูกส่งแล้ว" description="ไม่สามารถแก้ไขรูปแบบการทำรายการหลังส่งคำขอ" label="ดูคำขอที่ส่งแล้ว" onClick={() => router.push("/valuation/handoff")} />
        ) : !hasExpectedPrice ? (
          <Recovery title="ยังไม่มีข้อมูลราคาครบ" description="ดูผลประเมินและระบุราคาที่ต้องการก่อนเลือกรูปแบบการทำรายการ" label={hasPreliminaryValuation(stored) ? "ระบุราคาที่ต้องการ" : "ดูผลประเมิน"} onClick={() => router.push(hasPreliminaryValuation(stored) ? "/valuation/expected-price" : stored?.device ? "/valuation/result" : "/valuation/device")} />
        ) : (
          <section className="atlas-reveal atlas-reveal-delay-1">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">คุณต้องการทำรายการแบบใด?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">เลือกหนึ่งรูปแบบเพื่อส่งพร้อมคำขอ หากเลือกขายฝาก จะเห็นข้อมูลค่าใช้จ่ายเบื้องต้นในขั้นตอนถัดไป โดยรายละเอียดสัญญาจะยืนยันภายหลัง</p>
            <fieldset className="mt-7 grid gap-4 sm:grid-cols-2">
              <legend className="sr-only">รูปแบบการทำรายการ</legend>
              {options.map((option, index) => {
                const checked = selected === option.value;
                return (
                  <div key={option.value} className="atlas-choice-enter" style={{ "--atlas-choice-index": Math.min(index, 6) } as CSSProperties}><label className={`atlas-interactive block min-h-48 cursor-pointer rounded-[var(--radius-feature)] border p-6 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-focus)] ${checked ? "border-[var(--color-selected-border)] bg-[var(--color-selected-surface)]" : "border-[var(--color-border-strong)] bg-white"}`}>
                    <span>
                      <input type="radio" name="transaction-intent" value={option.value} checked={checked}
                        onChange={() => setSelectionOverride(option.value)} className="peer sr-only" />
                      <span>
                        <span className="block font-semibold text-slate-900">{option.label}</span>
                        <span className="mt-2 block text-sm leading-6 text-slate-600">{option.description}</span>
                      </span>
                    </span>
                  </label></div>
                );
              })}
            </fieldset>
            <div aria-live="polite">{selected === "sell_and_repurchase" ? <RepurchaseHint /> : null}</div>
            <div className="atlas-reveal atlas-reveal-delay-2 mt-6"><FlowActions back={<FlowBack onClick={() => router.push("/valuation/expected-price")} />} forward={<FlowForward type="button" disabled={!selected} onClick={handleContinue}>ดำเนินการต่อ</FlowForward>} /></div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

// Plain-language explanation shown when the seller picks ขายฝาก.
function RepurchaseHint() {
  const points = [
    "ส่งมอบเครื่องให้ผู้รับซื้อ และได้รับเงินก้อนไปใช้ก่อน",
    "ซื้อเครื่องคืนได้ภายในระยะเวลาที่ตกลงกัน โดยชำระยอดที่ยังค้างอยู่ พร้อมดอกเบี้ยและค่าธรรมเนียมตามสัญญา",
    "ถ้ายังไม่พร้อมซื้อคืน ขอต่อสัญญาได้ โดยชำระดอกเบี้ย ค่าธรรมเนียม และเงินต้นบางส่วนก่อนครบกำหนด",
    "ถ้าไม่ซื้อคืนภายในกำหนด เครื่องจะเป็นของผู้รับซื้อ",
  ];
  return (
    <section aria-labelledby="repurchase-hint-title" className="atlas-flow-panel-muted atlas-reveal mt-5 px-5 py-5 sm:px-6">
      <h3 id="repurchase-hint-title" className="text-base font-semibold text-slate-900">ขายฝากคืออะไร?</h3>
      <p className="mt-1.5 text-sm leading-6 text-slate-600">
        ขายเครื่องพร้อมสิทธิ์ซื้อคืน เหมาะเมื่อต้องการเงินตอนนี้ แต่ยังอยากได้เครื่องกลับมาใช้ ต่างจากขายขาดที่ขายแล้วไม่ได้เครื่องคืน
      </p>
      <ol className="mt-4 space-y-2.5">
        {points.map((point, index) => (
          <li key={point} className="flex gap-3 text-sm leading-6 text-slate-700">
            <span aria-hidden="true" className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] text-xs font-semibold text-[var(--color-action-primary)]">{index + 1}</span>
            <span>{point}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs leading-5 text-slate-500">อัตราดอกเบี้ยและค่าธรรมเนียมเบื้องต้นจะแสดงในขั้นตอนถัดไป และยืนยันอีกครั้งก่อนทำสัญญา</p>
    </section>
  );
}

function Recovery({ title, description, label, onClick }: { title: string; description: string; label: string; onClick: () => void }) {
  return <section className="atlas-reveal atlas-reveal-delay-1 rounded-3xl bg-white px-5 py-10 text-center">
    <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    <Button className="mt-6" onClick={onClick}>{label}</Button>
  </section>;
}
