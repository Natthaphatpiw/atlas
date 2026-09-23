"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MockAnalyticsService } from "@/adapters/mock/analytics";
import { hasCompletedAssessment, hasRequestPrerequisites, hasSubmittedRequest, type StoredValuationSession } from "@/lib/valuation-session";

const analytics = new MockAnalyticsService();
const noSubscription = () => () => undefined;
const getRaw = () => window.sessionStorage.getItem("atlast.valuation.session");
const button = "mt-6 w-full rounded-full bg-[var(--color-action-primary)] px-5 py-3.5 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]";

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
      : !hasRequestPrerequisites(stored) ? ["ระบุราคาที่ต้องการ", "/valuation/expected-price"]
        : ["กรอกข้อมูลติดต่อและส่งคำขอ", "/valuation/lead"];
  return <AppShell title="เชื่อมต่อ LINE" description="ช่องทางติดต่อและติดตามคำขอหลังส่งข้อมูล" compactHeader>
    <div className="mx-auto max-w-[640px]">
      {!request ? <section className="rounded-2xl bg-white p-5">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold">ยังไม่มีคำขอที่ส่งแล้วในต้นแบบนี้</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">ต้องส่งคำขอประเมินสินค้าก่อนเชื่อมต่อ LINE สถานะการส่งข้อมูลจากต้นแบบเดิมไม่ใช่คำขอฉบับนี้</p>
        {stored?.session?.request ? <p role="alert" className="mt-3 text-sm leading-7 text-slate-600">อ่านคำขอที่เก็บไว้ไม่ได้ ต้นแบบนี้ไม่สามารถกู้คืนหรือแก้ไขคำขอนี้ได้ กรุณาเริ่มการทดลองในเซสชันเบราว์เซอร์ใหม่</p>
          : <button className={button} onClick={() => router.push(recovery[1])}>{recovery[0]}</button>}
      </section> : <>
        <h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold">ส่งคำขอเรียบร้อยแล้วในต้นแบบ</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">ข้อมูลสินค้า สภาพเครื่อง และราคาที่คุณต้องการอยู่ในคำขอนี้แล้ว ไม่ต้องกรอกหรือส่งซ้ำ การเชื่อมต่อ LINE เป็นขั้นตอนถัดไปและไม่เปลี่ยนสถานะการส่งคำขอ</p>
        <p className="mt-3 text-sm leading-7 text-slate-500">คำขอจำลองนี้เก็บเฉพาะในเซสชันเบราว์เซอร์ ยังไม่ได้ส่งถึงเจ้าหน้าที่ Atlas หรือบันทึกบนเซิร์ฟเวอร์ และไม่ได้เก็บข้อมูลติดต่อของคุณ</p>
        <section aria-label="สรุปคำขอ" className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">เลขอ้างอิงต้นแบบ</p>
          <p className="mt-1 font-semibold">{request.reference}</p>
          <p className="mt-4 break-words font-medium">{request.context.device.model}</p>
          <p className="mt-1 break-words text-sm leading-6 text-slate-500">{Object.values(request.context.device.specs).filter(Boolean).join(" · ")}</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="text-slate-500">ราคาที่คุณต้องการ</dt><dd className="mt-1">฿{request.context.expectedPrice.amount.toLocaleString("en-US")}</dd></div>
            <div><dt className="text-slate-500">ราคาประเมินเบื้องต้น (ตัวอย่าง)</dt><dd className="mt-1">฿{request.context.preliminaryValuation.minPrice.toLocaleString("en-US")} – ฿{request.context.preliminaryValuation.maxPrice.toLocaleString("en-US")}</dd></div>
          </dl>
        </section>
        <h3 className="mt-6 font-semibold">เชื่อมต่อ LINE เพื่อรับการติดต่อและติดตามรายการ</h3>
        <p className="mt-2 text-sm leading-7 text-slate-600">เมื่อเปิดระบบจริง LINE จะเป็นช่องทางคุยกับเจ้าหน้าที่ ติดตามคำขอ และรับการแจ้งสถานะ โดยเจ้าหน้าที่จะใช้ข้อมูลจากคำขอนี้ คุณไม่ต้องแจ้งรายละเอียดสินค้าอีกครั้ง</p>
        <button className={button} aria-describedby="line-prototype" onClick={() => {
          setPlaceholder(true);
          if (!started.current) {
            started.current = true;
            analytics.track({ eventName: "line_connect_started", sessionId: request.sessionId, route: "/valuation/handoff", timestamp: new Date().toISOString() });
          }
        }}>เชื่อมต่อ LINE (ทดลอง) →</button>
        <div id="line-prototype" role="status" className="mt-3 text-sm leading-7 text-slate-600">
          {placeholder ? "ต้นแบบนี้ยังไม่เปิดการเชื่อมต่อ LINE ไม่มีการเชื่อมบัญชี เพิ่มเพื่อน หรือส่งข้อความ คำขอจำลองของคุณยังอยู่และไม่ต้องส่งใหม่" : "การเชื่อมต่อ LINE ยังไม่เปิดใช้งานในต้นแบบนี้"}
        </div>
      </>}
    </div>
  </AppShell>;
}
