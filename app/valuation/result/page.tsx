import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function ResultPage() {
  return (
    <AppShell
      title="Valuation result"
      description="Display the Atlast estimated valuation to the seller. This is a demo-only mock valuation placeholder."
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Mock valuation summary</p>
        <div className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">฿16,400</div>
        <p className="mt-2 text-sm text-slate-600">This estimate is for demo and development purposes only and is not production business logic.</p>
        <div className="mt-6 flex gap-3">
          <Link href="/valuation/expected-price" className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Back
          </Link>
          <Link href="/valuation/lead" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
            Proceed
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
