import { astlyErrorResponse, getAstlyEstimate } from "@/lib/server/astly-client";
import { issuePriceReceipt, readEstimateTicketClaims } from "@/lib/server/visitor";

const NO_STORE = { "Cache-Control": "no-store" };

// Polls an Astly estimate. The signed ticket issued when the job started names
// its visitor, so polling keeps working after the visitor's IP changes.
export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  try {
    const claims = /^[0-9a-f-]{16,64}$/i.test(jobId) ? readEstimateTicketClaims(request.headers.get("x-estimate-ticket"), jobId) : null;
    if (!claims) {
      return Response.json({ code: "job_not_found", error: "ไม่พบรายการประเมินนี้ กรุณาเริ่มประเมินใหม่" }, { status: 404, headers: NO_STORE });
    }
    const state = await getAstlyEstimate(jobId, claims.visitor);
    // Vouches for the finished price, so a later LIFF request can be checked without asking Astly again.
    if (state.status === "COMPLETED" && state.result && claims.inputHash) {
      state.priceReceipt = issuePriceReceipt(jobId, claims.inputHash, state.result);
    }
    return Response.json(state, { headers: NO_STORE });
  } catch (error) {
    return astlyErrorResponse(error);
  }
}
