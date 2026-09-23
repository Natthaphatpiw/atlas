"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { MockValuationService } from "@/adapters/mock/valuation";
import { AppShell } from "@/components/app-shell";
import { DeviceAssessment } from "@/components/device-assessment";
import type { AssessmentDefinition } from "@/domain/assessment";
import type { StoredValuationSession } from "@/lib/valuation-session";

const service = new MockValuationService();
const noSubscription = () => () => undefined;
const getRaw = () => window.sessionStorage.getItem("atlast.valuation.session");

export default function ConditionPage() {
  const router = useRouter();
  const raw = useSyncExternalStore(noSubscription, getRaw, () => null);
  const stored = useMemo(() => {
    try {
      const parsed = raw ? JSON.parse(raw) as StoredValuationSession : null;
      return parsed?.device && parsed?.session ? parsed : null;
    } catch { return null; }
  }, [raw]);
  const [definition, setDefinition] = useState<AssessmentDefinition | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!stored) return;
    let active = true;
    void service.getDeviceAssessment(stored.device).then((value) => {
      if (active) setDefinition(value);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [stored]);

  if (stored && definition) return <DeviceAssessment key={`${stored.session.id}-${definition.id}`} initial={stored} definition={definition} />;
  return (
    <AppShell title="ประเมินสภาพด้วยตนเอง" description="ข้อมูลจากผู้ขายสำหรับราคาประเมินเบื้องต้น" compactHeader>
      {stored && !failed ? <p role="status">กำลังเตรียมแบบประเมิน...</p> : (
        <div className="rounded-3xl bg-white p-6">
          <p role="status">{failed ? "ยังเตรียมแบบประเมินไม่ได้ กรุณาลองอีกครั้ง" : "กรุณาเลือกสินค้าก่อนเริ่มประเมินสภาพ"}</p>
          <button type="button" onClick={() => router.push("/valuation/device")} className="mt-5 rounded-full bg-[var(--color-action-primary)] px-5 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2">เลือกสินค้า</button>
        </div>
      )}
    </AppShell>
  );
}
