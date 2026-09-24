"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle04Icon, Message01Icon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui-primitives";
import { MockAnalyticsService } from "@/adapters/mock/analytics";
import { hasCompletedAssessment, hasPreliminaryValuation, hasReachedStage, hasSubmittedRequest, type StoredValuationSession } from "@/lib/valuation-session";

const analytics = new MockAnalyticsService();
const noSubscription = () => () => undefined;
const getRaw = () => window.sessionStorage.getItem("atlast.valuation.session");

function formatPrice(value: number) {
  return `฿${value.toLocaleString("en-US")}`;
}

export default function ConnectLinePage() {
  const router = useRouter();
  const raw = useSyncExternalStore(noSubscription, getRaw, () => null);
  const stored = useMemo(() => {
    try { return raw ? JSON.parse(raw) as StoredValuationSession : null; } catch { return null; }
  }, [raw]);
  const submitted = hasSubmittedRequest(stored);
  const request = submitted ? stored?.session.request : undefined;
  const [placeholder, setPlaceholder] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const viewed = useRef<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    heading.current?.focus();
    if (request && viewed.current !== request.id) {
      viewed.current = request.id;
      analytics.track({ eventName: "line_connect_viewed", sessionId: request.sessionId, route: "/valuation/handoff", timestamp: new Date().toISOString() });
    }
  }, [request]);

  const recovery = !stored?.device ? ["เลือกสินค้า", "/valuation/device"]
    : !hasCompletedAssessment(stored) ? ["ตอบคำถามสภาพ", "/valuation/condition"]
      : !hasPreliminaryValuation(stored) ? ["ดูผลประเมิน", "/valuation/result"]
        : !hasReachedStage(stored.session.status, "expected_price_entered") ? ["ระบุราคาที่ต้องการ", "/valuation/expected-price"]
          : !hasReachedStage(stored.session.status, "transaction_intent_selected") ? ["เลือกรูปแบบการทำรายการ", "/valuation/transaction-intent"]
            : ["กรอกข้อมูลติดต่อและส่งคำขอ", "/valuation/lead"];

  if (!request) {
    return <AppShell title="สถานะคำขอ" description="ส่งคำขอประเมินก่อน แล้วจึงเลือกช่องทางติดตาม" compactHeader backAction={<span className="hidden" aria-hidden="true" />}>
      <section className="mx-auto max-w-[42rem] rounded-[var(--radius-feature)] border border-[var(--color-border-strong)] bg-white p-6 shadow-[var(--shadow-surface)] sm:p-8">
        <h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-[-0.05em] text-[var(--color-foreground)]">ยังไม่มีคำขอที่ส่งแล้ว</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--color-muted-foreground)]">ส่งคำขอประเมินสินค้าก่อนเพื่อรับเลขอ้างอิง แล้วจึงเลือกติดตามการอัปเดตผ่าน LINE ได้</p>
        {stored?.session?.request ? <p role="alert" className="mt-4 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] px-4 py-3 text-sm leading-6 text-[var(--color-muted-foreground)]">ไม่สามารถอ่านคำขอที่เก็บไว้ได้ กรุณาเริ่มการทดลองในเซสชันเบราว์เซอร์ใหม่</p>
          : <Button className="mt-6 w-full sm:w-auto" onClick={() => router.push(recovery[1])}>{recovery[0]}</Button>}
      </section>
    </AppShell>;
  }

  const deviceSpecs = Object.values(request.context.device.specs).filter(Boolean).join(" · ");
  const intent = request.context.transactionIntent === "outright_sale" ? "ขายขาด" : "ขายฝาก";

  return <AppShell title="คำขอประเมินของคุณ" description="คำขอถูกบันทึกแล้ว คุณไม่ต้องกรอกหรือส่งซ้ำ" compactHeader backAction={<span className="hidden" aria-hidden="true" />}>
    <div className="mx-auto max-w-[var(--layout-financial)]">
      <section className="rounded-[var(--radius-feature)] border border-[var(--color-border-strong)] bg-white p-6 shadow-[var(--shadow-surface)] sm:p-8 lg:p-10">
        <div className="max-w-2xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-brand-primary-soft)] text-[var(--color-action-primary)] shadow-[var(--shadow-tactile-sm)]">
            <HugeiconsIcon icon={CheckmarkCircle04Icon} size={27} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <p className="mt-6 text-sm font-semibold text-[var(--color-action-primary)]">Atlas · คำขอประเมิน</p>
          <h2 ref={heading} tabIndex={-1} className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-[var(--color-foreground)] sm:text-4xl">ส่งคำขอประเมินเรียบร้อยแล้ว</h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--color-muted-foreground)]">เราได้บันทึกข้อมูลอุปกรณ์ สภาพ และราคาที่คุณต้องการไว้ในคำขอนี้แล้ว ขั้นตอนถัดไปคือเลือกช่องทางรับการอัปเดต</p>
        </div>

        <section aria-label="เลขอ้างอิงคำขอ" className="mt-8 rounded-[var(--radius-surface)] border border-[var(--color-action-primary)] bg-[var(--color-surface-subtle)] p-5 shadow-[var(--shadow-tactile-sm)] sm:flex sm:items-end sm:justify-between sm:gap-6">
          <div>
            <p className="text-sm font-medium text-[var(--color-muted-foreground)]">เลขอ้างอิงคำขอ</p>
            <p className="atlas-numeric mt-2 break-all font-mono text-2xl font-semibold tracking-[0.04em] text-[var(--color-foreground)] sm:text-3xl">{request.reference}</p>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-6 text-[var(--color-muted-foreground)] sm:mt-0">เก็บเลขนี้ไว้สำหรับอ้างอิงการติดต่อในภายหลัง</p>
        </section>

        <section aria-label="สรุปคำขอ" className="mt-6 border-t border-[var(--color-border-soft)] pt-6">
          <p className="text-sm font-semibold text-[var(--color-foreground)]">สรุปคำขอ</p>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div className="min-w-0"><dt className="text-[var(--color-muted-foreground)]">อุปกรณ์</dt><dd className="mt-1 break-words font-semibold text-[var(--color-foreground)]">{request.context.device.model}</dd><dd className="mt-1 break-words leading-6 text-[var(--color-muted-foreground)]">{deviceSpecs}</dd></div>
            <div><dt className="text-[var(--color-muted-foreground)]">รูปแบบการทำรายการ</dt><dd className="mt-1 font-semibold text-[var(--color-foreground)]">{intent}</dd></div>
            <div><dt className="text-[var(--color-muted-foreground)]">ราคาที่คุณต้องการ</dt><dd className="atlas-numeric mt-1 font-semibold text-[var(--color-foreground)]">{formatPrice(request.context.expectedPrice.amount)}</dd></div>
            <div><dt className="text-[var(--color-muted-foreground)]">ราคาประเมินเบื้องต้น</dt><dd className="atlas-numeric mt-1 font-semibold text-[var(--color-foreground)]">{formatPrice(request.context.preliminaryValuation.minPrice)} – {formatPrice(request.context.preliminaryValuation.maxPrice)}</dd></div>
          </dl>
        </section>
      </section>

      <section aria-labelledby="line-heading" className="mt-6 rounded-[var(--radius-feature)] border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] p-6 shadow-[var(--shadow-tactile-sm)] sm:p-8">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <HugeiconsIcon icon={Message01Icon} size={23} strokeWidth={1.8} className="text-[var(--color-action-primary)]" aria-hidden="true" />
            <h2 id="line-heading" className="text-xl font-semibold tracking-[-0.04em] text-[var(--color-foreground)]">รับการอัปเดตผ่าน LINE</h2>
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted-foreground)]">เมื่อเปิดระบบจริง LINE จะเป็นช่องทางติดต่อและติดตามคำขอของคุณได้ การส่งคำขอนี้เสร็จสมบูรณ์แล้วและไม่ต้องเชื่อมต่อ LINE เพื่อส่งคำขอ</p>
          <Button className="mt-5 w-full sm:w-auto" tone="secondary" aria-describedby="line-prototype" onClick={() => {
            setPlaceholder(true);
            if (!started.current) {
              started.current = true;
              analytics.track({ eventName: "line_connect_started", sessionId: request.sessionId, route: "/valuation/handoff", timestamp: new Date().toISOString() });
            }
          }}>
            <HugeiconsIcon icon={Message01Icon} size={19} strokeWidth={1.8} aria-hidden="true" />
            เชื่อมต่อ LINE (ทดลอง)
          </Button>
          <p id="line-prototype" role="status" className="mt-4 text-sm leading-6 text-[var(--color-muted-foreground)]">{placeholder ? "ต้นแบบนี้ยังไม่เปิดการเชื่อมต่อ LINE ไม่มีการเชื่อมบัญชี เพิ่มเพื่อน หรือส่งข้อความ คำขอของคุณยังอยู่และไม่ต้องส่งใหม่" : "การเชื่อมต่อ LINE ยังไม่เปิดใช้งานในต้นแบบนี้"}</p>
        </div>
      </section>

      <p className="mt-5 text-center text-xs leading-6 text-[var(--color-subtle-foreground)]">คำขอจำลองนี้เก็บในเซสชันเบราว์เซอร์ ยังไม่ได้ส่งถึงเจ้าหน้าที่หรือบันทึกบนเซิร์ฟเวอร์ และไม่แสดงข้อมูลติดต่อของคุณในหน้านี้</p>
    </div>
  </AppShell>;
}
