import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function ValuationPage() {
  return (
    <AppShell
      title="Valuation start"
      description="Start the Atlast device valuation flow for a seller in Thailand."
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Tell us about the device</h2>
        <p className="mt-2 text-sm text-slate-600">
          This is the first step in the valuation funnel. The actual UX will be designed in a later phase.
        </p>
        <div className="mt-6">
          <Link
            href="/valuation/device"
            className="inline-flex rounded-full bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700"
          >
            Start valuation
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
