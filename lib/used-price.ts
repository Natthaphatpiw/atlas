// The price Atlas shows a seller is a used-market price: Astly's market
// reference price for the model (`marketPrice`, from Thai used listings),
// adjusted by the condition multiplier from the seller's answers. Astly's own
// `estimatedPrice` is a lending figure (a share of that price) and is never
// shown. Shared by the browser and Atlas's server so both arrive at one number.

/** Used-market price in THB, to the nearest 100; 0 (no offer) when Astly found no market price or the condition is ~0. */
export function usedMarketPrice(result: { marketPrice: number; condition: number }): number {
  if (!Number.isFinite(result.marketPrice) || result.marketPrice <= 0) return 0;
  const condition = Number.isFinite(result.condition) ? Math.min(1, Math.max(0, result.condition)) : 1;
  return Math.round((result.marketPrice * condition) / 100) * 100;
}
