"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { MockAnalyticsService } from "@/adapters/mock/analytics";
import { HowItWorksModal } from "@/components/how-it-works-modal";

const analyticsService = new MockAnalyticsService();

const benefitPills = ["เลือกรุ่น", "ระบุสภาพ", "ดูราคาเบื้องต้น"];

export default function Home() {
  const viewTracked = useRef(false);
  useEffect(() => {
    if (viewTracked.current) return;
    viewTracked.current = true;
    analyticsService.track({
      eventName: "landing_viewed",
      route: "/",
      timestamp: new Date().toISOString(),
    });
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--color-background)] text-[var(--color-foreground)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,_var(--color-brand-primary-glow)_0%,_transparent_70%)] blur-3xl sm:-left-20 sm:h-80 sm:w-80" />
        <div className="absolute right-[-5rem] top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,_var(--color-brand-primary-glow)_0%,_transparent_72%)] blur-3xl sm:right-[-4rem] sm:h-80 sm:w-80" />
        <div className="absolute left-1/2 top-20 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full border border-[var(--color-border-soft)] bg-[radial-gradient(circle,_rgba(7,192,97,0.08),_transparent_62%)] blur-2xl" />
        <div className="absolute inset-x-0 top-40 h-px bg-gradient-to-r from-transparent via-[var(--color-border-soft)] to-transparent" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-4 pb-0 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <Link href="/" aria-label="Atlast home" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-sm font-bold text-white shadow-[0_12px_24px_var(--color-brand-primary-glow)]">
            A
          </span>
          <span className="text-xl font-bold tracking-[-0.06em] text-[var(--color-foreground)]">Atlast</span>
        </Link>

        <nav className="flex items-center text-sm font-medium text-[var(--color-muted-foreground)]">
          <HowItWorksModal />
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-4 pb-16 pt-10 text-center sm:px-6 lg:pb-24 lg:pt-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface)]/80 px-3 py-1.5 text-[11px] font-semibold tracking-[0.18em] text-[var(--color-muted-foreground)] uppercase backdrop-blur-sm">
          Atlast
        </span>

        <h1 className="mt-6 max-w-3xl text-[clamp(2.6rem,8vw,6rem)] font-bold leading-[0.92] tracking-[-0.09em] text-[var(--color-foreground)]">
          <span className="block">ประเมินราคาสินค้า</span>
          <span className="block text-[var(--color-brand-primary)]">ได้ง่ายกว่าที่เคย</span>
        </h1>

        <p className="mt-6 max-w-xl text-base leading-7 text-[var(--color-muted-foreground)] sm:text-lg">
          Atlast ช่วยให้คุณเห็นช่วงราคาประเมินเบื้องต้นจากรุ่นและสภาพอุปกรณ์ก่อนตัดสินใจขายหรือแลกเปลี่ยน
        </p>

        <div className="mt-8 flex justify-center">
          <Link
            href="/valuation/device"
            className="group inline-flex min-h-[60px] items-center justify-center gap-2 rounded-full bg-[var(--color-action-primary)] px-7 py-4 text-base font-semibold text-white shadow-[0_18px_40px_var(--color-brand-primary-glow)] transition-all duration-200 hover:bg-[var(--color-action-primary-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-brand-primary-soft)]"
          >
            <span>เริ่มประเมินราคา</span>
            <span className="text-xl transition-transform duration-200 group-hover:translate-x-0.5">→</span>
          </Link>
        </div>

        <div className="mt-5 text-xs tracking-[0.02em] text-[var(--color-muted-foreground)]">
          เริ่มจากรุ่นและสภาพสินค้า
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {benefitPills.map((text) => (
            <div
              key={text}
              className="rounded-full border border-[var(--color-border-soft)] bg-white/80 px-3.5 py-2 text-[11px] font-medium tracking-[0.02em] text-[var(--color-foreground)] backdrop-blur-sm"
            >
              {text}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
