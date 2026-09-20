import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function ConditionPage() {
  return (
    <AppShell
      title="Condition assessment"
      description="Collect the seller's answers that influence the estimated valuation."
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Placeholder route for the condition questions step.</p>
        <div className="mt-6 flex gap-3">
          <Link href="/valuation/device" className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Back
          </Link>
          <Link href="/valuation/expected-price" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Continue
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
