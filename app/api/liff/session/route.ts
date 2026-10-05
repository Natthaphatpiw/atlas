import { after } from "next/server";
import { atlasDbConfigured, atlasRpc } from "@/lib/server/atlas-db";
import { friendStatusOf } from "@/lib/server/line-messaging";
import { issueLiffSession, LiffAuthError, readLiffSession, verifyLineIdToken } from "@/lib/server/liff-auth";

const NO_STORE = { "Cache-Control": "no-store" };

function recordUser(user: { line_user_id: string; display_name?: string; picture_url?: string; is_friend?: boolean }) {
  if (!atlasDbConfigured()) return;
  after(() => atlasRpc("atlas_ingest_liff_events", { user }).catch(() => undefined));
}

function failure(error: unknown) {
  if (error instanceof LiffAuthError) return Response.json({ code: error.code }, { status: error.status, headers: NO_STORE });
  console.error("[liff] session failed", error instanceof Error ? error.name : "unknown");
  return Response.json({ code: "liff_unavailable" }, { status: 503, headers: NO_STORE });
}

// Starts a LIFF session: verifies the LINE ID token, records the LINE user and
// says whether they have added the Atlas OA, which the app requires first.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { idToken?: unknown } | null;
  try {
    const identity = await verifyLineIdToken(body?.idToken);
    const isFriend = await friendStatusOf(identity);
    const session = issueLiffSession(identity);
    recordUser({
      line_user_id: identity.userId,
      display_name: identity.displayName,
      picture_url: identity.pictureUrl,
      ...(isFriend === null ? {} : { is_friend: isFriend }),
    });
    return Response.json({ token: session.token, expiresAt: session.expiresAt, isFriend }, { headers: NO_STORE });
  } catch (error) {
    return failure(error);
  }
}

// Re-checks friendship after the app sent the user to add the Atlas OA.
export async function GET(request: Request) {
  try {
    const session = readLiffSession(request);
    if (!session) return Response.json({ code: "unauthorized" }, { status: 401, headers: NO_STORE });
    const isFriend = await friendStatusOf(session);
    if (isFriend !== null) recordUser({ line_user_id: session.userId, is_friend: isFriend });
    return Response.json({ isFriend }, { headers: NO_STORE });
  } catch (error) {
    return failure(error);
  }
}
