import Link from "next/link";
import type { ReactNode } from "react";

type AppShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function AppShell({ title, description, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            Atlast
          </Link>
          <nav className="flex items-center gap-3 text-sm text-slate-600">
            <Link href="/valuation" className="rounded-full border border-slate-200 px-3 py-2 hover:border-slate-300 hover:text-slate-900">
              Start valuation
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-700">Atlast MVP</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description ? <p className="mt-2 max-w-2xl text-sm text-slate-600">{description}</p> : null}
        </div>

        {children}
      </main>
    </div>
  );
}
