import { astlyErrorResponse, getAstlyEstimate } from "@/lib/server/astly-client";
import { readEstimateTicket } from "@/lib/server/visitor";

const NO_STORE = { "Cache-Control": "no-store" };

// Polls an Astly estimate. The signed ticket issued when the job started names
// its visitor, so polling keeps working after the visitor's IP changes.
export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  try {
    const visitor = /^[0-9a-f-]{16,64}$/i.test(jobId) ? readEstimateTicket(request.headers.get("x-estimate-ticket"), jobId) : null;
    if (!visitor) {
      return Response.json({ code: "job_not_found", error: "ไม่พบรายการประเมินนี้ กรุณาเริ่มประเมินใหม่" }, { status: 404, headers: NO_STORE });
    }
    return Response.json(await getAstlyEstimate(jobId, visitor), { headers: NO_STORE });
  } catch (error) {
    return astlyErrorResponse(error);
  }
}
