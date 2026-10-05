// The valuation flow is served twice: on the web at / and /valuation/*, and
// inside LINE as a LIFF app at /liff and /liff/valuation/*. Pages are written
// against the web paths; these map between the two copies.

export const LIFF_BASE = "/liff";

export const isLiffPath = (pathname: string | null | undefined) =>
  pathname === LIFF_BASE || Boolean(pathname?.startsWith(`${LIFF_BASE}/`));

/** A web flow path ("/", "/valuation/device") as it appears under the given base. */
export function toFlowPath(base: string, path: string) {
  if (!base || !path.startsWith("/")) return path;
  return path === "/" ? base : `${base}${path}`;
}

/** The web flow path for a pathname from either copy, so pages compare one set of paths. */
export function toCanonicalPath(pathname: string) {
  if (!isLiffPath(pathname)) return pathname;
  return pathname.slice(LIFF_BASE.length) || "/";
}
