import { parseEstimateRequest } from "@/lib/estimate-request";
import { astlyErrorResponse, createAstlyEstimate, estimateMessages } from "@/lib/server/astly-client";
import { issueEstimateTicket, visitorId } from "@/lib/server/visitor";

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
    const visitor = visitorId(request.headers);
    const accepted = await createAstlyEstimate(input, visitor);
    return Response.json({ ...accepted, ticket: issueEstimateTicket(accepted.jobId, visitor) }, { status: 202, headers: NO_STORE });
  } catch (error) {
    return astlyErrorResponse(error);
  }
}
