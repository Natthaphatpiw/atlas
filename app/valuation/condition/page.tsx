"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useFlowRouter } from "@/lib/flow-navigation";
import { MockValuationService } from "@/adapters/mock/valuation";
import { AppShell } from "@/components/app-shell";
import { DeviceAssessment } from "@/components/device-assessment";
import { Button } from "@/components/ui-primitives";
import type { AssessmentDefinition } from "@/domain/assessment";
import type { StoredValuationSession } from "@/lib/valuation-session";

const service = new MockValuationService();
const noSubscription = () => () => undefined;
const getRaw = () => window.sessionStorage.getItem("atlast.valuation.session");

export default function ConditionPage() {
  const router = useFlowRouter();
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
    <AppShell title="ประเมินสภาพด้วยตนเอง" description="ข้อมูลจากผู้ขายสำหรับราคาประเมินเบื้องต้น" compactHeader flowStage="condition">
      {stored && !failed ? <p role="status">กำลังเตรียมแบบประเมิน...</p> : (
        <div className="rounded-3xl bg-white p-6">
          <p role="status">{failed ? "ยังเตรียมแบบประเมินไม่ได้ กรุณาลองอีกครั้ง" : "กรุณาเลือกสินค้าก่อนเริ่มประเมินสภาพ"}</p>
          <Button className="mt-5" onClick={() => router.push("/valuation/device")}>เลือกสินค้า</Button>
        </div>
      )}
    </AppShell>
  );
}
