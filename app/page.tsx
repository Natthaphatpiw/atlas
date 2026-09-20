import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function Home() {
  return (
    <AppShell
      title="Validate demand for a device pawn service"
      description="Atlast helps sellers understand the likely value of their device and connect with the Atlast LINE Official Account when they want to continue."
    >
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-700">Thailand</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Get a quick estimate for your device</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
            This MVP is intended to validate seller demand. It keeps the front-end flow intentionally minimal while preparing the service boundaries for a future backend.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/valuation"
              className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-700"
            >
              Start valuation
            </Link>
            <Link
              href="/valuation/handoff"
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View handoff placeholder
            </Link>
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-slate-900 p-6 text-slate-50 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-300">MVP scope</p>
          <ul className="mt-4 space-y-3 text-sm text-slate-200">
            <li>• Landing</li>
            <li>• Valuation flow</li>
            <li>• Lead capture</li>
            <li>• LINE OA handoff boundary</li>
          </ul>
        </aside>
      </div>
    </AppShell>
  );
}
