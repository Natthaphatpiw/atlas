"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { MockAnalyticsService } from "@/adapters/mock/analytics";
import { HowItWorksModal } from "@/components/how-it-works-modal";
import { PageContainer } from "@/components/page-container";

const analyticsService = new MockAnalyticsService();
export default function Home() {
  const viewTracked = useRef(false);
  useEffect(() => {
    if (viewTracked.current) return;
    viewTracked.current = true;
    analyticsService.track({ eventName: "landing_viewed", route: "/", timestamp: new Date().toISOString() });
  }, []);

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[var(--color-canvas)] text-[var(--color-foreground)]">
      <header className="border-b border-[var(--color-border-soft)] bg-[var(--color-canvas)]">
        <PageContainer size="shell" className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Atlas home" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[var(--color-brand-primary)]" />
            Atlas
          </Link>
          <HowItWorksModal triggerLabel="วิธีการใช้งาน" triggerClassName="atlas-focus atlas-interactive inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-4 py-2 text-sm font-semibold text-white" />
        </PageContainer>
      </header>

      <main>
        <PageContainer size="shell" className="relative flex min-h-[calc(100dvh-73px)] items-center justify-center overflow-hidden px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,_var(--color-brand-primary-soft)_0%,_transparent_68%)] opacity-70" />
          <section className="relative max-w-3xl text-center">
            <div>
              <p className="text-sm font-semibold text-[var(--color-action-primary)]">Atlas · ประเมินเบื้องต้น</p>
              <h1 className="mt-4 text-4xl font-semibold leading-[1.18] tracking-tight text-[var(--color-foreground)] sm:text-5xl lg:text-6xl">
                ประเมินราคามือถือ<br />
                <span className="text-[var(--color-action-primary)]">และอุปกรณ์ IT ได้ง่าย</span><br />
                ในไม่กี่ขั้นตอน
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[var(--color-muted-foreground)] sm:text-lg">
                Atlas ให้ช่วงราคาประเมินเบื้องต้นจากรุ่นอุปกรณ์และสภาพที่คุณระบุ เพื่อช่วยให้ตัดสินใจก่อนดำเนินการต่อ
              </p>
              <div className="mt-8 flex justify-center">
                <Link href="/valuation/device" className="atlas-focus atlas-interactive inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-5 py-3 text-base font-semibold text-white">
                  เริ่มประเมินราคา <HugeiconsIcon icon={ArrowRight02Icon} size={19} strokeWidth={1.8} aria-hidden="true" />
                </Link>
              </div>
              <div className="mt-8 text-sm text-[var(--color-muted-foreground)]">
                <span>ข้อมูลของคุณใช้เพื่อประเมินเบื้องต้นในเบราว์เซอร์นี้</span>
              </div>
            </div>
          </section>
        </PageContainer>
      </main>
    </div>
  );
}
