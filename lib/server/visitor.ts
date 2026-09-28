import { createHmac, timingSafeEqual } from "node:crypto";
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

const TICKET_MAX_AGE_MS = 3 * 60 * 60 * 1000;

/**
 * A job belongs to the visitor that started it, but a visitor's IP changes
 * (Wi-Fi to cellular, relays). The browser keeps this signed ticket so it can
 * keep polling its own job from any network; only starting a job is metered
 * by the current network.
 */
export function issueEstimateTicket(jobId: string, visitor: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ j: jobId, v: visitor, t: now })).toString("base64url");
  return `${payload}.${hmac("atlas-ticket-v1", payload)}`;
}

/** The visitor a ticket was issued to, or null if it is forged, expired or for another job. */
export function readEstimateTicket(ticket: string | null, jobId: string, now = Date.now()): string | null {
  if (!ticket || ticket.length > 1024) return null;
  const [payload, signature, extra] = ticket.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(hmac("atlas-ticket-v1", payload));
  const presented = Buffer.from(signature);
  if (expected.length !== presented.length || !timingSafeEqual(expected, presented)) return null;
  try {
    const { j, v, t } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { j?: unknown; v?: unknown; t?: unknown };
    if (j !== jobId || typeof v !== "string" || typeof t !== "number" || now - t > TICKET_MAX_AGE_MS || t > now + 60_000) return null;
    return v;
  } catch {
    return null;
  }
}
