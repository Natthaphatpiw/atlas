"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { MockAnalyticsService } from "@/adapters/mock/analytics";
import { AppShell } from "@/components/app-shell";
import { FlowActions, FlowBack, FlowForward } from "@/components/flow-actions";
import { Button } from "@/components/ui-primitives";
import { hasPreliminaryValuation, updateExpectedPrice, type StoredValuationSession } from "@/lib/valuation-session";
import { formatDeviceSpecs, formatValuation } from "@/lib/valuation-format";

const storageKey = "atlast.valuation.session";
const analyticsService = new MockAnalyticsService();
const noSessionSubscription = () => () => undefined;

function getStoredSessionRaw() {
  return typeof window === "undefined" ? null : window.sessionStorage.getItem(storageKey);
}

function parseStoredSession(rawSession: string | null) {
  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as StoredValuationSession;
  } catch {
    return null;
  }
}

export default function ExpectedPricePage() {
  const router = useRouter();
  const storedSessionRaw = useSyncExternalStore(noSessionSubscription, getStoredSessionRaw, () => null);
  const storedSession = useMemo(() => parseStoredSession(storedSessionRaw), [storedSessionRaw]);
  const [draftDigits, setDraftDigits] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [hasInvalidCharacters, setHasInvalidCharacters] = useState(false);

  const persistedDigits = storedSession?.session.expectedPrice?.amount
    ? formatStoredAmount(storedSession.session.expectedPrice.amount)
    : "";
  const priceDigits = draftDigits ?? persistedDigits;
  const numericAmount = priceDigits ? Number(priceDigits) : null;
  const isValidAmount =
    !hasInvalidCharacters &&
    priceDigits.length > 0 &&
    numericAmount !== null &&
    Number.isSafeInteger(numericAmount) &&
    numericAmount > 0;
  const hasCompletedPrerequisites = hasPreliminaryValuation(storedSession);
  const prerequisiteRoute = storedSession?.device ? "/valuation/result" : "/valuation/device";

  const handleInputChange = (value: string) => {
    setHasInteracted(true);
    setHasInvalidCharacters(/[^0-9,]/.test(value));
    setDraftDigits(value.replace(/\D/g, ""));
  };

  const handleBack = () => {
    router.push("/valuation/result");
  };

  const handleContinue = () => {
    if (!isValidAmount || !storedSession || numericAmount === null) {
      return;
    }

    if (!updateExpectedPrice(numericAmount)) return;
    analyticsService.track({
      eventName: "expected_price_entered",
      sessionId: storedSession.session.id,
      route: "/valuation/expected-price",
      deviceCategory: storedSession.device.category,
      deviceId: storedSession.device.id,
      expectedAmount: numericAmount,
      timestamp: new Date().toISOString(),
    });
    router.push("/valuation/transaction-intent");
  };

  return (
    <AppShell
      title="ราคาที่ต้องการ"
      description="บอกเราว่าคุณต้องการขายสินค้านี้ในราคาเท่าไหร่"
      compactHeader
      contentSize="financial"
      flowStage="price"
      refined
      showHeaderBack={false}
    >
      <div className="mx-auto max-w-[920px]">
        {!storedSession ? (
          <MissingContext
            title="ยังไม่มีสินค้าที่เลือก"
            description="กลับไปเลือกสินค้าก่อนเริ่มขั้นตอนราคาที่ต้องการ"
            actionLabel="เลือกสินค้า"
            onAction={() => router.push("/valuation/device")}
          />
        ) : !hasCompletedPrerequisites ? (
          <MissingContext
            title="ยังไม่มีผลประเมินเบื้องต้น"
            description="ดูผลประเมินเบื้องต้นก่อนระบุราคาที่คุณต้องการขาย"
            actionLabel="ดูผลประเมิน"
            onAction={() => router.push(prerequisiteRoute)}
          />
        ) : (
          <>
            <div className="atlas-flow-panel-muted atlas-reveal mb-4 px-5 py-4">
              <p className="text-base font-semibold text-slate-900">{storedSession.device.model}</p>
              <p className="mt-0.5 text-sm text-slate-600">{formatDeviceSpecs(storedSession.device)}</p>
            </div>

            <div className="atlas-flow-panel atlas-reveal atlas-reveal-delay-1 mb-8 px-5 py-5">
              <p className="text-sm text-slate-500">ราคาประเมินเบื้องต้นจาก {storedSession.session.preliminaryValuation?.source === "astly" ? "Astly" : "Atlas"}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {formatValuation(storedSession.session.preliminaryValuation!)}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">ใช้เป็นข้อมูลประกอบการตัดสินใจ ราคาที่คุณระบุจะไม่เปลี่ยนผลประเมินเบื้องต้นนี้</p>
            </div>

            <section className="atlas-reveal atlas-reveal-delay-2 w-full">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">คุณต้องการขายในราคาเท่าไหร่?</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">ระบุราคาที่คุณต้องการอย่างอิสระ โดย Atlas จะไม่ปรับราคาให้อัตโนมัติ</p>

              <label htmlFor="expected-price" className="mt-7 block">
                <span className="sr-only">ราคาที่ต้องการขาย เป็นเงินบาท</span>
                <span className="atlas-flow-panel flex items-center px-5 py-5 transition focus-within:border-[var(--color-focus)] focus-within:ring-2 focus-within:ring-[var(--color-focus-ring)] sm:px-7 sm:py-6">
                  <span className="mr-3 text-2xl font-semibold text-[var(--color-action-primary)]" aria-hidden="true">
                    ฿
                  </span>
                  <input
                    id="expected-price"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9,]*"
                    value={formatAmount(priceDigits)}
                    onChange={(event) => handleInputChange(event.target.value)}
                    aria-describedby={hasInteracted && !isValidAmount ? "expected-price-error" : undefined}
                    aria-invalid={hasInteracted && !isValidAmount}
                    placeholder="0"
                    className={[
                      "min-w-0 flex-1 bg-transparent font-semibold tracking-tight text-slate-900 outline-none placeholder:text-slate-300",
                      getPriceInputSize(priceDigits),
                    ].join(" ")}
                  />
                  <span className="ml-3 shrink-0 text-sm font-medium text-slate-500">บาท</span>
                </span>
              </label>
              {hasInteracted && !isValidAmount ? (
                <p id="expected-price-error" aria-live="polite" className="mt-2 text-sm text-rose-700">
                  {getValidationMessage(priceDigits, hasInvalidCharacters)}
                </p>
              ) : null}

              <div className="mt-5"><FlowActions back={<FlowBack onClick={handleBack} />} forward={<FlowForward type="button" onClick={handleContinue} disabled={!isValidAmount}>ดำเนินการต่อ</FlowForward>} /></div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function MissingContext({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-3xl bg-white px-5 py-10 text-center">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <Button className="mt-6" onClick={onAction}>{actionLabel}</Button>
    </div>
  );
}

function formatAmount(digits: string) {
  if (!digits) {
    return "";
  }

  const normalizedDigits = digits.replace(/^0+(?=\d)/, "");
  return normalizedDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatStoredAmount(amount: number) {
  return Number.isInteger(amount) ? BigInt(amount).toString() : String(amount);
}

function getPriceInputSize(digits: string) {
  const formattedLength = formatAmount(digits).length;

  if (formattedLength <= 9) {
    return "text-3xl sm:text-4xl";
  }

  if (formattedLength <= 15) {
    return "text-2xl sm:text-3xl";
  }

  if (formattedLength <= 22) {
    return "text-xl sm:text-2xl";
  }

  if (formattedLength <= 28) {
    return "text-lg sm:text-xl";
  }

  return "text-base sm:text-lg";
}

function getValidationMessage(digits: string, hasInvalidCharacters: boolean) {
  if (hasInvalidCharacters || !digits) {
    return "กรุณาระบุราคาเป็นตัวเลข";
  }

  if (!Number.isSafeInteger(Number(digits))) {
    return "จำนวนเงินเกินช่วงที่ระบบรองรับ กรุณาระบุจำนวนเงินที่น้อยลง";
  }

  return "กรุณาระบุราคามากกว่า 0 บาท";
}
