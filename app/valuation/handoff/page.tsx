import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function HandoffPage() {
  return (
    <AppShell
      title="Atlast LINE OA handoff"
      description="Prepare the handoff boundary for the seller to continue with the Atlast LINE Official Account."
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">
          This is a placeholder handoff boundary only. LINE integration is not implemented yet.
        </p>
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-700">Handoff target</p>
          <p className="mt-2 text-sm text-slate-600">LINE Official Account URL placeholder</p>
        </div>
        <div className="mt-6 flex gap-3">
          <Link href="/valuation/lead" className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Back
          </Link>
          <a
            href="https://line.me/"
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Open LINE placeholder
          </a>
        </div>
      </div>
    </AppShell>
  );
}
