import Link from "next/link";
import type { ReactNode } from "react";

type AppShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
  backAction?: ReactNode;
  compactHeader?: boolean;
};

export function AppShell({ title, description, children, backAction, compactHeader = false }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-slate-900">
      <header className="border-b border-[var(--color-border-soft)] bg-white/90 backdrop-blur-sm">
        <div className={compactHeader ? "mx-auto flex max-w-4xl items-center gap-3 px-4 py-4 sm:px-6" : "mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8"}>
          {compactHeader ? (
            <>
              {backAction ?? (
                <Link href="/" aria-label="กลับหน้าแรก" className="rounded-full p-1 text-xl text-slate-700 hover:bg-slate-100">
                  ←
                </Link>
              )}
              <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
                Atlast
              </Link>
            </>
          ) : (
            <>
              <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
                Atlast
              </Link>
              <nav className="flex items-center gap-3 text-sm text-slate-600">
                <Link href="/valuation" className="rounded-full border border-slate-200 px-3 py-2 hover:border-slate-300 hover:text-slate-900">
                  Start valuation
                </Link>
              </nav>
            </>
          )}
        </div>
      </header>

      <main className={compactHeader ? "mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12" : "mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8"}>
        <div className="mb-6">
          {!compactHeader ? <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-700">Atlast MVP</p> : null}
          <h1 className={compactHeader ? "text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl" : "mt-2 text-3xl font-semibold tracking-tight text-slate-900"}>{title}</h1>
          {description ? <p className={compactHeader ? "mt-3 max-w-2xl text-base leading-7 text-slate-600" : "mt-2 max-w-2xl text-sm text-slate-600"}>{description}</p> : null}
        </div>

        {children}
      </main>
    </div>
  );
}
