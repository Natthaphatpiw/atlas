"use client";

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui-primitives";
import { hasSubmittedRequest, startNewValuation, type StoredValuationSession } from "@/lib/valuation-session";
import { consumeForwardPath } from "@/lib/forward-navigation";

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
  useLayoutEffect(() => {
    if (consumeForwardPath(pathname)) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  useEffect(() => { if (locked) heading.current?.focus(); }, [locked, pathname]);

  if (!hydrated) return null;
  if (locked) return <AppShell title={submitted ? "คำขอนี้ส่งแล้ว" : "อ่านคำขอเดิมไม่ได้"} compactHeader contentSize="financial" refined showHeaderBack={false} stickyHeader>
    <section className="atlas-flow-panel atlas-reveal atlas-reveal-delay-1 mx-auto max-w-[42rem] p-6 sm:p-8">
      <h2 ref={heading} tabIndex={-1} className="atlas-programmatic-heading-focus text-2xl font-semibold tracking-[-0.05em] text-[var(--color-foreground)]">{submitted ? "ดูคำขอที่ส่งแล้ว" : "ไปดูสถานะคำขอ"}</h2>
      <p className="mt-3 text-sm leading-7 text-[var(--color-muted-foreground)]">{submitted
        ? "ข้อมูลของคำขอที่ส่งแล้วจะถูกล็อกไว้ เพื่อให้รายละเอียดอุปกรณ์ สภาพ และราคาตรงกับคำขอเดิม"
        : "ต้นแบบนี้อ่านคำขอที่เก็บไว้ไม่ได้ จึงไม่สามารถแก้ไขหรือส่งทับคำขอเดิมได้ กรุณาเริ่มการทดลองในเซสชันเบราว์เซอร์ใหม่"}</p>
      {submitted ? <div className="mt-6 grid gap-3 sm:grid-cols-2"><Button onClick={() => { startNewValuation(); router.push("/valuation/device"); }}>ประเมินสินค้าอื่น</Button><Button tone="secondary" className="!text-[var(--color-action-primary)]" onClick={() => router.push("/valuation/handoff")}>ดูคำขอที่ส่งแล้ว</Button></div> : <Button className="mt-6 w-full sm:w-auto" onClick={() => router.push("/valuation/handoff")}>ดูสถานะคำขอ</Button>}
    </section>
  </AppShell>;
  return children;
}
