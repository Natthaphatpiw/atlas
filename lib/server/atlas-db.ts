// Server-only access to Atlas's tables in the shared Astly Supabase project
// (database/atlas_liff.sql), through PostgREST with the service-role key.
// The key bypasses RLS, so it must never reach the browser.

const TIMEOUT_MS = 10_000;

export class AtlasDbError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(`Atlas database request failed (${status} ${code})`);
    this.name = "AtlasDbError";
  }
}

function config() {
  const url = (process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  return url && key ? { url, key } : null;
}

export const atlasDbConfigured = () => config() !== null;

/** Postgres text and jsonb cannot hold U+0000; a stray one (say, in a campaign link) would fail the whole write. */
export function withoutNul(value: unknown): unknown {
  if (typeof value === "string") return value.includes("\u0000") ? value.replaceAll("\u0000", "") : value;
  if (Array.isArray(value)) return value.map(withoutNul);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [withoutNul(key) as string, withoutNul(item)]));
  }
  return value;
}

async function call(path: string, init: { method: string; body: unknown; prefer?: string }) {
  const settings = config();
  if (!settings) throw new AtlasDbError(503, "db_unconfigured");
  let response: Response;
  try {
    response = await fetch(`${settings.url}/rest/v1/${path}`, {
      method: init.method,
      headers: {
        apikey: settings.key,
        authorization: `Bearer ${settings.key}`,
        "content-type": "application/json",
        accept: "application/json",
        ...(init.prefer ? { prefer: init.prefer } : {}),
      },
      body: JSON.stringify(withoutNul(init.body)),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new AtlasDbError(503, "db_unreachable");
  }
  if (!response.ok) {
    // Log PostgREST's error code only: messages can echo row values (contact details).
    const body = (await response.json().catch(() => null)) as { code?: unknown } | null;
    const code = typeof body?.code === "string" ? body.code : "unknown";
    console.error("[atlas-db] request failed", { path: path.split("?")[0], status: response.status, code });
    throw new AtlasDbError(response.status, code);
  }
  return response;
}

/** Calls one of the atlas_* functions with its single jsonb argument. */
export async function atlasRpc<T>(fn: "atlas_ingest_liff_events" | "atlas_submit_sale_request", payload: unknown): Promise<T> {
  const response = await call(`rpc/${fn}`, { method: "POST", body: { p_payload: payload } });
  return (await response.json()) as T;
}

export async function updateSaleRequest(id: string, fields: Record<string, unknown>) {
  await call(`atlas_sale_requests?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { ...fields, updated_at: new Date().toISOString() },
    prefer: "return=minimal",
  });
}
