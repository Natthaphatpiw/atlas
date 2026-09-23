"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { MockAnalyticsService } from "@/adapters/mock/analytics";
import { AppShell } from "@/components/app-shell";
import type { Device } from "@/domain/types";
import { hasCompletedAssessment, updateExpectedPrice, type StoredValuationSession } from "@/lib/valuation-session";

const valuationProgress = ["สินค้า", "สภาพ", "ราคาที่ต้องการ", "ผลประเมิน"];
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
  const hasCompletedPrerequisites =
    hasCompletedAssessment(storedSession);
  const prerequisiteRoute = storedSession?.device ? "/valuation/condition" : "/valuation/device";

  const handleInputChange = (value: string) => {
    setHasInteracted(true);
    setHasInvalidCharacters(/[^0-9,]/.test(value));
    setDraftDigits(value.replace(/\D/g, ""));
  };

  const handleBack = () => {
    if (hasCompletedPrerequisites && isValidAmount && numericAmount !== null) {
      updateExpectedPrice(numericAmount);
    }
    router.push("/valuation/condition");
  };

  const handleContinue = () => {
    if (!isValidAmount || !storedSession || numericAmount === null) {
      return;
    }

    updateExpectedPrice(numericAmount);
    analyticsService.track({
      eventName: "expected_price_entered",
      sessionId: storedSession.session.id,
      route: "/valuation/expected-price",
      deviceCategory: storedSession.device.category,
      deviceId: storedSession.device.id,
      expectedAmount: numericAmount,
      timestamp: new Date().toISOString(),
    });
    router.push("/valuation/result");
  };

  return (
    <AppShell
      title="ราคาที่ต้องการ"
      description="บอกเราว่าคุณต้องการขายสินค้านี้ในราคาเท่าไหร่"
      compactHeader
      backAction={
        <button
          type="button"
          onClick={handleBack}
          aria-label="ย้อนกลับ"
          className="rounded-full p-1 text-xl text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
        >
          ←
        </button>
      }
    >
      <div className="mx-auto max-w-[820px]">
        <ValuationProgress />

        {!storedSession ? (
          <MissingContext
            title="ยังไม่มีสินค้าที่เลือก"
            description="กลับไปเลือกสินค้าก่อนเริ่มขั้นตอนราคาที่ต้องการ"
            actionLabel="เลือกสินค้า"
            onAction={() => router.push("/valuation/device")}
          />
        ) : !hasCompletedPrerequisites ? (
          <MissingContext
            title="ยังตอบคำถามสภาพไม่ครบ"
            description="ตอบคำถามเกี่ยวกับสภาพสินค้าให้ครบก่อนระบุราคาที่ต้องการ"
            actionLabel="กลับไปตอบคำถาม"
            onAction={() => router.push(prerequisiteRoute)}
          />
        ) : (
          <>
            <div className="mb-6 rounded-xl bg-[var(--color-surface-subtle)] px-4 py-2.5">
              <p className="text-base font-semibold text-slate-900">{storedSession.device.model}</p>
              <p className="mt-0.5 text-sm text-slate-600">{formatDeviceSpecs(storedSession.device)}</p>
            </div>

            <section>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">คุณต้องการขายในราคาเท่าไหร่?</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">ระบุราคาที่คุณคาดหวัง เพื่อใช้ประกอบการประเมินเบื้องต้น</p>

              <label htmlFor="expected-price" className="mt-7 block">
                <span className="sr-only">ราคาที่ต้องการขาย เป็นเงินบาท</span>
                <span className="flex items-center rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-[0_8px_24px_rgba(10,26,22,0.04)] transition focus-within:border-[var(--color-brand-primary)] focus-within:ring-2 focus-within:ring-[var(--color-brand-primary-glow)]">
                  <span className="mr-3 text-2xl font-semibold text-[var(--color-brand-primary-hover)]" aria-hidden="true">
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

              <button
                type="button"
                onClick={handleContinue}
                disabled={!isValidAmount}
                className="mt-5 flex w-full items-center justify-center rounded-full bg-[var(--color-action-primary)] px-5 py-3.5 text-base font-semibold text-white shadow-[0_8px_20px_rgba(7,192,97,0.18)] transition-colors hover:bg-[var(--color-action-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
              >
                ดำเนินการต่อ →
              </button>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function ValuationProgress() {
  return (
    <div className="mb-8 flex items-center gap-2" aria-label="ความคืบหน้าการประเมินราคา">
      {valuationProgress.map((step, index) => (
        <div key={step} className="flex min-w-0 flex-1 items-center gap-2">
          <div
            className={[
              "h-1.5 flex-1 rounded-full",
              index < 3 ? "bg-[var(--color-brand-primary)]" : "bg-slate-200",
            ].join(" ")}
          />
          <span
            className={[
              "hidden whitespace-nowrap text-xs sm:block",
              index === 2 ? "font-semibold text-slate-900" : index < 2 ? "text-[var(--color-brand-primary-hover)]" : "text-slate-400",
            ].join(" ")}
          >
            {step}
          </span>
        </div>
      ))}
    </div>
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
      <button
        type="button"
        onClick={onAction}
        className="mt-6 rounded-full bg-[var(--color-action-primary)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--color-action-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
      >
        {actionLabel}
      </button>
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

function formatDeviceSpecs(device: Device) {
  return Array.from(new Set([device.variant, ...Object.values(device.specs)].filter(Boolean))).join(" · ");
}