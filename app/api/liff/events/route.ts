import { AtlasDbError, atlasDbConfigured, atlasRpc } from "@/lib/server/atlas-db";
import { readLiffSession } from "@/lib/server/liff-auth";
import { allowEvents, clockOffsetMs, isVisitId, sanitizeEvents, sanitizeSnapshot } from "@/lib/server/liff-events";

const MAX_BODY_BYTES = 64 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };
let warnedUnconfigured = false;

// Stores a batch of LIFF usage events and the valuation snapshot they belong to.
export async function POST(request: Request) {
  const session = readLiffSession(request);
  if (!session) return Response.json({ code: "unauthorized" }, { status: 401, headers: NO_STORE });
  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY_BYTES) return Response.json({ code: "too_large" }, { status: 413, headers: NO_STORE });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return Response.json({ code: "invalid_request" }, { status: 400, headers: NO_STORE });
  }

  const now = Date.now();
  const offset = clockOffsetMs(body?.sentAt, now);
  const events = sanitizeEvents(body?.events, offset, now);
  if (!isVisitId(body?.visitId) || !events) return Response.json({ code: "invalid_request" }, { status: 400, headers: NO_STORE });
  const snapshot = body.session == null ? null : sanitizeSnapshot(body.session, offset, now);
  if (!events.length && !snapshot) return new Response(null, { status: 204, headers: NO_STORE });
  if (!allowEvents(session.userId, events.length, now)) return Response.json({ code: "rate_limited" }, { status: 429, headers: NO_STORE });

  if (!atlasDbConfigured()) {
    if (!warnedUnconfigured) console.warn("[liff] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set; LIFF events are dropped");
    warnedUnconfigured = true;
    return new Response(null, { status: 204, headers: NO_STORE });
  }
  try {
    await atlasRpc("atlas_ingest_liff_events", { user: { line_user_id: session.userId }, visit_id: body.visitId, session: snapshot, events });
    return new Response(null, { status: 204, headers: NO_STORE });
  } catch (error) {
    // Data the database refuses will be refused again: tell the app to drop it rather than resend it forever.
    if (error instanceof AtlasDbError && [400, 409, 422].includes(error.status)) {
      return Response.json({ code: "rejected" }, { status: 422, headers: NO_STORE });
    }
    return Response.json({ code: "unavailable" }, { status: 503, headers: NO_STORE });
  }
}
