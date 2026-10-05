import type { Liff } from "@line/liff";

// Thin wrapper over the LINE LIFF SDK. The SDK is loaded on demand in the
// browser only. In development, NEXT_PUBLIC_LIFF_MOCK=true replaces LINE with
// a local identity (which the server also accepts only outside production).

const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim() ?? "";
const oaBasicId = process.env.NEXT_PUBLIC_LINE_OA_BASIC_ID?.trim() ?? "";
export const liffMock = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_LIFF_MOCK === "true";
const mockUserId = process.env.NEXT_PUBLIC_LIFF_MOCK_USER_ID?.trim() || "Udeadbeefdeadbeefdeadbeefdeadbeef";

export class LiffClientError extends Error {
  constructor(readonly code: "liff_unconfigured" | "liff_init_failed" | "missing_id_token") {
    super(code);
    this.name = "LiffClientError";
  }
}

const RELOGIN_KEY = "atlas.liff.relogin";

let sdk: Liff | null = null;
let started: Promise<{ idToken: string } | { redirecting: true }> | null = null;

/** Initializes LIFF once per page and returns the LINE ID token to verify on the server. */
export function initLiff() {
  started ??= (async () => {
    if (liffMock) return { idToken: `mock:${mockUserId}` };
    if (!liffId) throw new LiffClientError("liff_unconfigured");
    const { default: liff } = await import("@line/liff");
    try {
      // Outside the LINE app this sends the visitor through LINE Login first.
      await liff.init({ liffId, withLoginOnExternalBrowser: true });
    } catch {
      throw new LiffClientError("liff_init_failed");
    }
    sdk = liff;
    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: window.location.href });
      return { redirecting: true as const };
    }
    // Requires the LIFF app's "openid" scope. LIFF keeps tokens across visits,
    // and an ID token lasts about an hour, so an old one means signing in again.
    const idToken = currentIdToken();
    if (!idToken) {
      if (relogin()) return { redirecting: true as const };
      throw new LiffClientError("missing_id_token");
    }
    return { idToken };
  })();
  started.catch(() => { started = null; });
  return started;
}

/** The LINE ID token, unless missing or about to expire. */
export function currentIdToken(): string | null {
  if (liffMock) return `mock:${mockUserId}`;
  if (!sdk) return null;
  const exp = sdk.getDecodedIDToken()?.exp;
  if (typeof exp === "number" && exp * 1000 < Date.now() + 60_000) return null;
  return sdk.getIDToken();
}

/**
 * Signs in to LINE again for fresh tokens: once per window, so a token LINE
 * keeps rejecting shows an error instead of looping. False if not attempted.
 */
export function relogin(): boolean {
  if (!sdk || liffMock) return false;
  try {
    if (window.sessionStorage.getItem(RELOGIN_KEY)) return false;
    window.sessionStorage.setItem(RELOGIN_KEY, String(Date.now()));
  } catch {
    return false;
  }
  sdk.logout();
  if (sdk.isInClient()) window.location.reload();
  else sdk.login({ redirectUri: window.location.href });
  return true;
}

/** Call once a session started, so a later expiry may sign in again. */
export function clearRelogin() {
  try {
    window.sessionStorage.removeItem(RELOGIN_KEY);
  } catch {
    // Storage unavailable: relogin() then never runs, which only costs the retry.
  }
}

/** LIFF's own friendship check, used when the server cannot tell. Null when unknown. */
export async function liffFriendship(): Promise<boolean | null> {
  if (!sdk) return null;
  try {
    return (await sdk.getFriendship()).friendFlag;
  } catch {
    return null;
  }
}

export const lineOaAddFriendUrl = () => (oaBasicId ? `https://line.me/R/ti/p/${encodeURIComponent(oaBasicId)}` : null);

/** Opens the Atlas OA's profile with its add-friend button; inside LINE it opens over the LIFF app. */
function openAddFriendPage() {
  const url = lineOaAddFriendUrl();
  if (!url) return false;
  if (sdk?.isInClient()) sdk.openWindow({ url, external: false });
  else window.open(url, "_blank", "noopener");
  return true;
}

/**
 * Asks the user to add the Atlas OA. Where LINE supports it, this is LIFF's
 * own add-friend dialog over the app ("dialog": it has closed, check the
 * friendship now; "cancelled": the user declined). Otherwise the OA's profile
 * opens ("page": check again when the user comes back).
 */
export async function requestAddFriend(): Promise<"dialog" | "cancelled" | "page" | "unavailable"> {
  if (sdk && oaBasicId.startsWith("@") && typeof sdk.requestFriendship === "function" && sdk.isApiAvailable("requestFriendship")) {
    try {
      await sdk.requestFriendship({ officialAccount: { id: oaBasicId } });
      return "dialog";
    } catch (error) {
      if ((error as { code?: unknown })?.code === "UNAUTHORIZED") return "cancelled";
      // Any other failure (rate limit, unlinked OA): fall back to the profile page.
    }
  }
  return openAddFriendPage() ? "page" : "unavailable";
}

/** Closes the LIFF window. False where LIFF cannot close it (an external browser, mock mode). */
export function closeLiffWindow() {
  if (!sdk?.isInClient()) return false;
  sdk.closeWindow();
  return true;
}

/** Where and how the LIFF app was opened, for analytics. */
export function liffEnvironment(): Record<string, string | number | boolean | null> {
  const environment: Record<string, string | number | boolean | null> = {
    mock: liffMock,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
  if (sdk) {
    environment.inClient = sdk.isInClient();
    environment.os = sdk.getOS() ?? null;
    environment.lineVersion = sdk.getLineVersion();
    environment.appLanguage = typeof sdk.getAppLanguage === "function" ? sdk.getAppLanguage() : sdk.getLanguage();
    environment.contextType = sdk.getContext()?.type ?? null;
  }
  return environment;
}
