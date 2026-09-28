import type { Device, PreliminaryValuation } from "@/domain/types";

export function formatBaht(amount: number) {
  return `฿${amount.toLocaleString("en-US")}`;
}

/** A single price when the valuation is a point estimate (Astly), otherwise a range. */
export function formatValuation(valuation: Pick<PreliminaryValuation, "minPrice" | "maxPrice">) {
  return valuation.minPrice === valuation.maxPrice
    ? formatBaht(valuation.minPrice)
    : `${formatBaht(valuation.minPrice)} – ${formatBaht(valuation.maxPrice)}`;
}

/** Variant and specs for a device summary line. */
export function formatDeviceSpecs(device: Device) {
  // A phone's catalog variant only repeats a storage size, which can contradict the one selected.
  const variant = device.category === "phone" ? undefined : device.variant;
  return Array.from(new Set([variant, ...Object.values(device.specs)].filter(Boolean))).join(" · ");
}
