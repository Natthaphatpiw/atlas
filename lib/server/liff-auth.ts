// Server-only identity for the LINE LIFF app. A LINE ID token from the LIFF
// SDK is verified with LINE once per visit; Atlas then issues its own signed
// session token, which every other /api/liff call presents as a bearer token.
import { timingSafeEqual } from "node:crypto";
import { signAtlasValue } from "@/lib/server/visitor";

export const LINE_USER_ID = /^U[0-9a-f]{32}$/;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const VERIFY_TIMEOUT_MS = 8_000;

export interface LineIdentity {
  userId: string;
  displayName?: string;
  pictureUrl?: string;
  /** A local development identity; never accepted in production builds. */
  mock: boolean;
}

export class LiffAuthError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
    this.name = "LiffAuthError";
  }
}

/** Local development only: lets `mock:<userId>` stand in for a LINE ID token. */
export function liffMockAuthEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.ATLAS_LIFF_MOCK_AUTH === "true";
}

/** The LINE Login channel that owns the LIFF app: LINE_LOGIN_CHANNEL_ID, else the LIFF ID's prefix. */
export function lineLoginChannelId(): string | null {
  const explicit = process.env.LINE_LOGIN_CHANNEL_ID?.trim();
  if (explicit) return /^\d{6,20}$/.test(explicit) ? explicit : null;
  const fromLiffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim().match(/^(\d{6,20})-[A-Za-z0-9]+$/)?.[1];
  return fromLiffId ?? null;
}

const httpsUrl = (value: unknown) =>
  typeof value === "string" && value.length <= 500 && /^https:\/\/[^\s]+$/.test(value) ? value : undefined;
const shortText = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;

const verified = new Map<string, { identity: LineIdentity; until: number }>();

/** Verifies a LIFF ID token with LINE and returns the user it names. */
export async function verifyLineIdToken(idToken: unknown, now = Date.now()): Promise<LineIdentity> {
  if (typeof idToken !== "string" || idToken.length < 10 || idToken.length > 4096) throw new LiffAuthError(400, "invalid_id_token");

  if (idToken.startsWith("mock:")) {
    const userId = idToken.slice(5);
    if (!liffMockAuthEnabled() || !LINE_USER_ID.test(userId)) throw new LiffAuthError(401, "invalid_id_token");
    return { userId, displayName: "Atlas Dev", mock: true };
  }

  // Only a JWT-shaped token is worth a call to LINE.
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(idToken)) throw new LiffAuthError(401, "invalid_id_token");
  const cached = verified.get(idToken);
  if (cached && cached.until > now) return cached.identity;

  const channelId = lineLoginChannelId();
  if (!channelId) {
    console.error("[liff] LINE_LOGIN_CHANNEL_ID (or NEXT_PUBLIC_LIFF_ID) is not set; cannot verify LINE ID tokens");
    throw new LiffAuthError(503, "liff_unconfigured");
  }
  let response: Response;
  try {
    response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
      cache: "no-store",
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
  } catch {
    throw new LiffAuthError(503, "line_unavailable");
  }
  // LINE answers 400 for a bad, expired or foreign-channel token.
  if (response.status === 400) throw new LiffAuthError(401, "invalid_id_token");
  if (!response.ok) throw new LiffAuthError(503, "line_unavailable");
  const claims = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!claims || typeof claims.sub !== "string" || !LINE_USER_ID.test(claims.sub) || claims.aud !== channelId ||
      claims.iss !== "https://access.line.me") {
    throw new LiffAuthError(401, "invalid_id_token");
  }

  const identity: LineIdentity = {
    userId: claims.sub,
    displayName: shortText(claims.name, 100),
    pictureUrl: httpsUrl(claims.picture),
    mock: false,
  };
  const expiresAt = typeof claims.exp === "number" ? claims.exp * 1000 : now;
  if (verified.size > 2_000) verified.clear();
  verified.set(idToken, { identity, until: Math.min(expiresAt, now + 60 * 60 * 1000) });
  return identity;
}

/** Atlas's own session token for a verified LINE user. */
export function issueLiffSession(identity: Pick<LineIdentity, "userId" | "mock">, now = Date.now()) {
  const expiresAt = now + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ u: identity.userId, e: expiresAt, ...(identity.mock ? { m: 1 } : {}) })).toString("base64url");
  return { token: `${payload}.${signAtlasValue("atlas-liff-session-v1", payload)}`, expiresAt };
}

/** The LINE user a request's bearer session token names, or null. */
export function readLiffSession(request: Request, now = Date.now()): Pick<LineIdentity, "userId" | "mock"> | null {
  const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/)?.[1];
  if (!token || token.length > 1024) return null;
  const [payload, signature] = token.split(".");
  let expected: Buffer;
  try {
    expected = Buffer.from(signAtlasValue("atlas-liff-session-v1", payload));
  } catch {
    return null;
  }
  const presented = Buffer.from(signature);
  if (expected.length !== presented.length || !timingSafeEqual(expected, presented)) return null;
  try {
    const { u, e, m } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u?: unknown; e?: unknown; m?: unknown };
    if (typeof u !== "string" || !LINE_USER_ID.test(u) || typeof e !== "number" || e < now || e > now + SESSION_TTL_MS + 60_000) return null;
    if (m === 1 && !liffMockAuthEnabled()) return null;
    return { userId: u, mock: m === 1 };
  } catch {
    return null;
  }
}
