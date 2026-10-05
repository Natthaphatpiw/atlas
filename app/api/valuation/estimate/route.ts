import { parseEstimateRequest } from "@/lib/estimate-request";
import { astlyErrorResponse, createAstlyEstimate, estimateMessages } from "@/lib/server/astly-client";
import { readLiffSession } from "@/lib/server/liff-auth";
import { estimateInputHash, issueEstimateTicket, lineVisitorId, visitorId } from "@/lib/server/visitor";

const MAX_BODY_BYTES = 32 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };

// Starts a real Astly estimate for the visitor's device and seller assessment.
export async function POST(request: Request) {
  const invalid = () => Response.json({ code: "invalid_request", error: estimateMessages.invalidRequest }, { status: 400, headers: NO_STORE });
  const text = await request.text().catch(() => "");
  if (!text || text.length > MAX_BODY_BYTES) return invalid();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return invalid();
  }
  const input = parseEstimateRequest(raw);
  if (!input) return invalid();

  try {
    // Inside the LINE LIFF app the signed-in LINE user is the visitor Astly meters.
    const liffUser = readLiffSession(request);
    const visitor = liffUser ? lineVisitorId(liffUser.userId) : visitorId(request.headers);
    const accepted = await createAstlyEstimate(input, visitor);
    const ticket = issueEstimateTicket(accepted.jobId, visitor, Date.now(), estimateInputHash(input));
    return Response.json({ ...accepted, ticket }, { status: 202, headers: NO_STORE });
  } catch (error) {
    return astlyErrorResponse(error);
  }
}
