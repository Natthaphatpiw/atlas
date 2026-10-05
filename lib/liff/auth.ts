// Atlas's LIFF session token for the current page, set once the LINE ID
// token has been verified (app/api/liff/session). Kept in memory only: a
// reload signs in again through LIFF.
let token: string | null = null;

export function setLiffAuthToken(value: string | null) {
  token = value;
}

export function getLiffAuthToken() {
  return token;
}

/** Authorization header for Atlas's own API while signed in to the LIFF app; empty on the web. */
export function liffAuthHeaders(): Record<string, string> {
  return token ? { authorization: `Bearer ${token}` } : {};
}

let reauthenticator: (() => Promise<boolean>) | null = null;
let reauthenticating: Promise<boolean> | null = null;

/** Registered by the LIFF app: gets a fresh session token, true on success. */
export function setLiffReauthenticator(fn: () => Promise<boolean>) {
  reauthenticator = fn;
}

let lastRenewedAt = 0;

/**
 * Called after a 401 from Atlas's API. Concurrent callers share one attempt,
 * and a token renewed under a minute ago is not renewed again, so a 401 the
 * renewal cannot cure does not loop.
 */
export function reauthenticateLiff(): Promise<boolean> {
  if (!reauthenticator || Date.now() - lastRenewedAt < 60_000) return Promise.resolve(false);
  reauthenticating ??= reauthenticator()
    .then((renewed) => {
      if (renewed) lastRenewedAt = Date.now();
      return renewed;
    })
    .catch(() => false)
    .finally(() => { reauthenticating = null; });
  return reauthenticating;
}
