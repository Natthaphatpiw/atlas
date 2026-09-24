import Link from "next/link";
import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { FlowProgress, type FlowStage } from "@/components/flow-progress";
import { PageContainer } from "@/components/page-container";

type AppShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
  backAction?: ReactNode;
  compactHeader?: boolean;
  flowStage?: FlowStage;
};

export function AppShell({ title, description, children, backAction, compactHeader = false, flowStage }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--color-foreground)]">
      <header className="border-b border-[var(--color-border-soft)] bg-[var(--color-canvas)]">
        <PageContainer size="shell" className="px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className={flowStage ? "flex flex-wrap items-center gap-x-3 gap-y-3 sm:grid sm:grid-cols-[1fr_minmax(20rem,34rem)_1fr] sm:gap-6" : "flex items-center justify-between gap-3"}>
            <div className="flex min-w-0 items-center gap-3">
              {compactHeader ? backAction ?? (
                <Link href="/" aria-label="กลับหน้าแรก" className="atlas-focus atlas-interactive inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] border border-transparent text-[var(--color-foreground)]">
                  <HugeiconsIcon icon={ArrowLeft02Icon} size={20} strokeWidth={1.8} aria-hidden="true" />
                </Link>
              ) : null}
              <Link href="/" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-[var(--color-foreground)]">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[var(--color-brand-primary)]" />
                Atlas
              </Link>
            </div>

            {flowStage ? <div className="order-3 basis-full sm:order-none sm:basis-auto"><FlowProgress currentStage={flowStage} /></div> : null}

            {!compactHeader ? (
              <nav className="flex justify-end text-sm">
                <Link href="/valuation" className="atlas-focus atlas-interactive inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-white px-4 py-2 font-semibold text-[var(--color-foreground)]">
                  เริ่มประเมินราคา
                </Link>
              </nav>
            ) : flowStage ? <div className="hidden sm:block" aria-hidden="true" /> : null}
          </div>
        </PageContainer>
      </header>

      <main className="py-8 sm:py-12">
        <PageContainer size={compactHeader ? "flow" : "shell"} className="px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-foreground)] sm:text-4xl">{title}</h1>
            {description ? <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--color-muted-foreground)]">{description}</p> : null}
          </div>

          {children}
        </PageContainer>
      </main>
    </div>
  );
}
