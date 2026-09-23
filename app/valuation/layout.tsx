"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { hasSubmittedRequest, type StoredValuationSession } from "@/lib/valuation-session";

const noSubscription = () => () => undefined;
const getRaw = () => window.sessionStorage.getItem("atlast.valuation.session");

// A submitted mock request is immutable for this browser session. Do not mount
// earlier forms, including during hydration, where they could mutate its context.
export default function ValuationLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  const raw = useSyncExternalStore(noSubscription, getRaw, () => null);
  const heading = useRef<HTMLHeadingElement>(null);
  let hasReceipt = false;
  let submitted = false;
  try {
    const stored = raw ? JSON.parse(raw) as StoredValuationSession : null;
    hasReceipt = Boolean(stored?.session?.request);
    submitted = hasSubmittedRequest(stored);
  } catch { /* Route recovery handles invalid JSON. */ }
  const locked = hasReceipt && pathname !== "/valuation/handoff";
  useEffect(() => { if (locked) heading.current?.focus(); }, [locked, pathname]);
  if (!hydrated) return null;
  if (locked) return <AppShell title={submitted ? "คำขอนี้ส่งแล้ว" : "อ่านคำขอเดิมไม่ได้"} compactHeader>
    <section className="mx-auto max-w-[640px] rounded-2xl bg-white p-5">
      <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold">{submitted ? "กลับไปดูคำขอและเชื่อมต่อ LINE" : "ไปดูสถานะคำขอ"}</h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">{submitted
        ? "ต้นแบบนี้ยังแก้ไขคำขอที่ส่งแล้วไม่ได้ เพื่อให้ข้อมูลสินค้า สภาพ และราคาตรงกับคำขอเดิม คุณไม่ต้องกรอกหรือส่งคำขอซ้ำ"
        : "ต้นแบบนี้อ่านคำขอที่เก็บไว้ไม่ได้ จึงไม่สามารถแก้ไขหรือส่งทับคำขอเดิมได้ กรุณาเริ่มการทดลองในเซสชันเบราว์เซอร์ใหม่"}</p>
      <button onClick={() => router.push("/valuation/handoff")} className="mt-5 w-full rounded-full bg-[var(--color-action-primary)] px-5 py-3.5 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2">{submitted ? "ดูคำขอที่ส่งแล้ว →" : "ดูสถานะคำขอ →"}</button>
    </section>
  </AppShell>;
  return children;
}
