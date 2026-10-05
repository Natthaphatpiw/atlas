import { FlowLink } from "@/lib/flow-navigation";
import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { AtlasBackground } from "@/components/atlas-background";
import { AtlasBrand } from "@/components/atlas-brand";
import { FlowProgress, type FlowStage } from "@/components/flow-progress";
import { PageContainer, type ContainerSize } from "@/components/page-container";

type AppShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
  backAction?: ReactNode;
  compactHeader?: boolean;
  contentSize?: ContainerSize;
  flowStage?: FlowStage;
  refined?: boolean;
  showHeaderBack?: boolean;
  stickyHeader?: boolean;
};

export function AppShell({
  title,
  description,
  children,
  backAction,
  compactHeader = false,
  contentSize,
  flowStage,
  refined = false,
  showHeaderBack = true,
  stickyHeader = false,
}: AppShellProps) {
  return (
    <div className={`${refined ? "atlas-background" : "bg-[var(--background)]"} min-h-dvh text-[var(--color-foreground)]`}>
      {refined ? <AtlasBackground /> : null}
      <header
        className={`${flowStage || stickyHeader ? "atlas-flow-header sticky top-0 z-40" : refined ? "atlas-header-surface" : "bg-[var(--color-canvas)]"} border-b border-[var(--color-border-soft)]`}
        style={flowStage || stickyHeader ? { backdropFilter: "blur(20px) saturate(1.08)", WebkitBackdropFilter: "blur(20px) saturate(1.08)" } : undefined}
      >
        <PageContainer size="shell" className="px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className={flowStage ? "flex flex-wrap items-center gap-x-3 gap-y-3 sm:grid sm:grid-cols-[1fr_minmax(20rem,34rem)_1fr] sm:gap-6" : "flex items-center justify-between gap-3"}>
            <div className="flex min-w-0 items-center gap-3">
              {compactHeader && showHeaderBack ? backAction ?? (
                <FlowLink href="/" aria-label="กลับหน้าแรก" className="atlas-focus atlas-interactive inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] border border-transparent text-[var(--color-foreground)]">
                  <HugeiconsIcon icon={ArrowLeft02Icon} size={20} strokeWidth={1.8} aria-hidden="true" />
                </FlowLink>
              ) : null}
              <AtlasBrand />
            </div>

            {flowStage ? <div className="order-3 basis-full sm:order-none sm:basis-auto"><FlowProgress currentStage={flowStage} /></div> : null}

            {!compactHeader ? (
              <nav className="flex justify-end text-sm">
                <FlowLink href="/valuation" className="atlas-focus atlas-interactive inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-white px-4 py-2 font-semibold text-[var(--color-foreground)]">
                  เริ่มประเมินราคา
                </FlowLink>
              </nav>
            ) : flowStage ? <div className="hidden sm:block" aria-hidden="true" /> : null}
          </div>
        </PageContainer>
      </header>

      <main className={refined ? "py-7 sm:py-10" : "py-8 sm:py-12"}>
        <PageContainer size={contentSize ?? (compactHeader ? "flow" : "shell")} className="px-4 sm:px-6 lg:px-8">
          <div className={`${refined ? "atlas-reveal mb-8 sm:mb-10" : "mb-6"}`}>
            <h1 className={`${refined ? "atlas-editorial-title text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.08]" : "text-3xl tracking-tight sm:text-4xl"} font-semibold text-[var(--color-foreground)]`}>{title}</h1>
            {description ? <p className={`${refined ? "atlas-editorial-copy mt-4 text-[1.05rem] sm:text-lg" : "mt-3 text-base"} max-w-2xl leading-7 text-[var(--color-muted-foreground)]`}>{description}</p> : null}
          </div>

          {children}
        </PageContainer>
      </main>
    </div>
  );
}
