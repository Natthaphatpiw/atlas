import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { AstlyEstimateInput } from "@/domain/astly";
import { AstlyApiError, estimateMessages } from "@/lib/server/astly-client";

// Atlas-only secret. It must differ from ASTLY_DEMO_API_KEY: Astly holds that
// key, and with it could enumerate IPv4 space to reverse visitor IDs.
function visitorSecret(): string {
  const secret = process.env.ATLAS_VISITOR_SECRET?.trim() ?? "";
  if (secret.length < 32 || secret === process.env.ASTLY_DEMO_API_KEY?.trim()) {
    console.error("[astly] ATLAS_VISITOR_SECRET must be set (>= 32 chars) and differ from ASTLY_DEMO_API_KEY");
    throw new AstlyApiError(503, { code: "estimate_unconfigured", error: estimateMessages.unavailable });
  }
  return secret;
}

const hmac = (label: string, value: string) =>
  createHmac("sha256", visitorSecret()).update(`${label}:${value}`).digest("base64url");

/** HMAC under ATLAS_VISITOR_SECRET; the label keeps each use's signatures apart. */
export const signAtlasValue = hmac;

/** One network: an IPv4 address, or the /64 an IPv6 host can freely rotate within. */
export function clientNetwork(headers: Headers): string {
  const raw = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "local";
  const ip = raw.replace(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i, "$1");
  if (!ip.includes(":")) return ip;
  const [head, tail = ""] = ip.toLowerCase().split("::");
  const groups = [...head.split(":").filter(Boolean)];
  const tailGroups = tail.split(":").filter(Boolean);
  while (groups.length + tailGroups.length < 8 && ip.includes("::")) groups.push("0");
  return `${[...groups, ...tailGroups].slice(0, 4).map((group) => group.padStart(4, "0")).join(":")}::/64`;
}

/**
 * Opaque per-visitor ID sent to Astly as X-Demo-Visitor, which meters demo
 * usage per visitor. It is an HMAC of the client network, so Astly never sees
 * the IP. On Vercel, x-forwarded-for is set by the platform and cannot be
 * spoofed by the client; behind another proxy, make sure the same holds.
 */
export function visitorId(headers: Headers): string {
  return hmac("atlas-visitor-v1", clientNetwork(headers)).slice(0, 32);
}

/**
 * Opaque visitor ID for a LINE user signed in to the LIFF app. Astly then
 * meters that LINE account rather than its network, which mobile carriers
 * share between many users.
 */
export function lineVisitorId(lineUserId: string): string {
  return hmac("atlas-visitor-line-v1", lineUserId).slice(0, 32);
}

/** Identity of the Astly request a job priced, carried in its ticket. */
export function estimateInputHash(input: AstlyEstimateInput): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("base64url").slice(0, 22);
}

const TICKET_MAX_AGE_MS = 3 * 60 * 60 * 1000;

/**
 * A job belongs to the visitor that started it, but a visitor's IP changes
 * (Wi-Fi to cellular, relays). The browser keeps this signed ticket so it can
 * keep polling its own job from any network; only starting a job is metered
 * by the current network.
 */
export function issueEstimateTicket(jobId: string, visitor: string, now = Date.now(), inputHash?: string): string {
  const payload = Buffer.from(JSON.stringify({ j: jobId, v: visitor, t: now, ...(inputHash ? { k: inputHash } : {}) })).toString("base64url");
  return `${payload}.${hmac("atlas-ticket-v1", payload)}`;
}

/** The visitor a ticket was issued to, or null if it is forged, expired or for another job. */
export function readEstimateTicket(ticket: string | null, jobId: string, now = Date.now()): string | null {
  return readEstimateTicketClaims(ticket, jobId, now)?.visitor ?? null;
}

/** A valid ticket's visitor and, for tickets issued since LIFF support, the hash of the input it priced. */
export function readEstimateTicketClaims(ticket: string | null | undefined, jobId: string, now = Date.now()):
  { visitor: string; inputHash?: string } | null {
  if (!ticket || ticket.length > 1024) return null;
  const [payload, signature, extra] = ticket.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(hmac("atlas-ticket-v1", payload));
  const presented = Buffer.from(signature);
  if (expected.length !== presented.length || !timingSafeEqual(expected, presented)) return null;
  try {
    const { j, v, t, k } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { j?: unknown; v?: unknown; t?: unknown; k?: unknown };
    if (j !== jobId || typeof v !== "string" || typeof t !== "number" || now - t > TICKET_MAX_AGE_MS || t > now + 60_000) return null;
    return typeof k === "string" ? { visitor: v, inputHash: k } : { visitor: v };
  } catch {
    return null;
  }
}

const PRICE_RECEIPT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PriceReceipt {
  estimatedPrice: number;
  marketPrice: number;
  pawnPrice: number;
  /** Astly's condition multiplier, 0–1. */
  condition: number;
}

/**
 * Atlas's signed record of a completed Astly result for one priced input,
 * issued when polling sees it. A LIFF submission presents it so the server can
 * trust the price without asking Astly again (Astly keeps jobs two hours).
 */
export function issuePriceReceipt(jobId: string, inputHash: string, price: PriceReceipt, now = Date.now()): string {
  const { estimatedPrice: e, marketPrice: m, pawnPrice: p, condition: c } = price;
  const payload = Buffer.from(JSON.stringify({ j: jobId, k: inputHash, e, m, p, c, t: now })).toString("base64url");
  return `${payload}.${hmac("atlas-price-v1", payload)}`;
}

/** The price a receipt vouches for, or null if it is forged, expired, or for another job or input. */
export function readPriceReceipt(receipt: unknown, jobId: string, inputHash: string, now = Date.now()): PriceReceipt | null {
  if (typeof receipt !== "string" || receipt.length > 1024) return null;
  const [payload, signature, extra] = receipt.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(hmac("atlas-price-v1", payload));
  const presented = Buffer.from(signature);
  if (expected.length !== presented.length || !timingSafeEqual(expected, presented)) return null;
  try {
    const { j, k, e, m, p, c, t } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
    if (j !== jobId || k !== inputHash || !finite(t) || now - t > PRICE_RECEIPT_MAX_AGE_MS || t > now + 60_000) return null;
    if (!finite(e) || !finite(m) || !finite(p) || !finite(c) || e <= 0) return null;
    return { estimatedPrice: e, marketPrice: m, pawnPrice: p, condition: c };
  } catch {
    return null;
  }
}
