"use client";

import { FlowLink } from "@/lib/flow-navigation";
import { useEffect, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { MockAnalyticsService } from "@/adapters/mock/analytics";
import { AtlasBackground } from "@/components/atlas-background";
import { AtlasBrand } from "@/components/atlas-brand";
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
    <div className="atlas-background min-h-dvh overflow-x-hidden text-[var(--color-foreground)]">
      <AtlasBackground />
      <header className="relative z-10">
        <PageContainer size="shell" className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <AtlasBrand />
          <HowItWorksModal triggerLabel="วิธีการใช้งาน" triggerClassName="atlas-focus atlas-interactive inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-brand-primary)]" />
        </PageContainer>
      </header>

      <main>
        <PageContainer size="shell" className="flex min-h-[calc(100dvh-77px)] items-center px-4 py-14 pb-36 sm:px-6 sm:py-20 sm:pb-56 lg:px-8">
          <section className="mx-auto w-full max-w-[68rem] text-center">
            <div className="atlas-reveal">
              <p className="text-sm font-semibold tracking-[0.02em] text-[var(--color-action-primary)]">ATLAS</p>
              <h1 className="atlas-editorial-title mx-auto mt-5 max-w-[62rem] text-[clamp(2.75rem,7vw,5.9rem)] font-semibold leading-[1.02] text-[var(--color-foreground)]">
                <span className="block">รู้ราคาประเมิน</span>
                <span className="mt-5 block text-[var(--color-brand-primary)] sm:mt-6">ก่อนตัดสินใจขาย</span>
              </h1>
              <p className="atlas-editorial-copy mx-auto mt-6 max-w-[40rem] text-base leading-7 text-[var(--color-muted-foreground)] sm:text-lg">
                ประเมินราคาสินค้า IT เบื้องต้น เพื่อช่วยให้คุณตัดสินใจได้อย่างมั่นใจ
              </p>
              <div className="mt-8 flex justify-center">
                <FlowLink href="/valuation/device" className="atlas-focus atlas-interactive inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-6 py-3 text-base font-semibold text-white">
                  เริ่มประเมินราคา <HugeiconsIcon icon={ArrowRight02Icon} size={19} strokeWidth={1.8} aria-hidden="true" />
                </FlowLink>
              </div>
            </div>

          </section>
        </PageContainer>
      </main>
    </div>
  );
}
