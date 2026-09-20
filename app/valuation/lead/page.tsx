import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function LeadPage() {
  return (
    <AppShell
      title="Lead / contact capture"
      description="Collect the minimum required contact information for the seller if they want to continue."
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Placeholder route for minimum lead capture.</p>
        <div className="mt-6 flex gap-3">
          <Link href="/valuation/result" className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Back
          </Link>
          <Link href="/valuation/handoff" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Continue to handoff
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
