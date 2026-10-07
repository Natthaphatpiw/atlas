import { toReceiptContext } from "@/adapters/mock/request";
import type { MockRequestReceipt, ValuationRequestInput } from "@/domain/valuation-request";
import { contactErrors, requiresAddress } from "@/lib/seller-contact";
import { getLiffAuthToken, reauthenticateLiff } from "@/lib/liff/auth";
import { flushLiffEvents, liffVisitId, sessionSnapshot } from "@/lib/liff/tracker";
import { readValuationSession } from "@/lib/valuation-session";
import type { RequestService } from "@/services/request-service";

const FLUSH_WAIT_MS = 2_000;

/**
 * Submits a request from the LINE LIFF app to Atlas's server, which stores it
 * against the signed-in LINE user and confirms it to them in LINE. The server
 * re-validates everything sent here.
 */
export class LiffRequestService implements RequestService {
  async submitRequest(input: ValuationRequestInput): Promise<MockRequestReceipt> {
    const requireAddress = requiresAddress(input.context.transactionIntent);
    if (Object.values(contactErrors(input.contact, { requireAddress })).some(Boolean)) throw new Error("Invalid contact");
    const stored = readValuationSession();
    const { device, assessment, preliminaryValuation, expectedPrice, transactionIntent } = input.context;
    if (!stored || stored.session.id !== input.sessionId || !assessment.reviewedAt) throw new Error("Invalid request context");
    if (!getLiffAuthToken()) throw new Error("No LIFF session");

    // Send the steps that led here first, without letting a slow network hold the request.
    await Promise.race([flushLiffEvents(), new Promise((resolve) => setTimeout(resolve, FLUSH_WAIT_MS))]);
    const astly = stored.session.preliminaryValuation?.astly;
    const send = () => fetch("/api/liff/requests", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${getLiffAuthToken()}` },
      cache: "no-store",
      body: JSON.stringify({
        visitId: liffVisitId(),
        sentAt: Date.now(),
        session: sessionSnapshot(stored),
        deviceId: device.id,
        specs: device.specs,
        assessment: { definitionId: assessment.definitionId, version: assessment.version, answers: assessment.answers },
        estimate: { jobId: astly?.jobId, ticket: astly?.ticket, priceReceipt: astly?.priceReceipt, estimatedPrice: preliminaryValuation.minPrice },
        expectedPrice: expectedPrice.amount,
        transactionIntent,
        contact: {
          fullName: input.contact.fullName,
          phone: input.contact.phone,
          consentToContact: input.contact.consentToContact,
          // Only ขายฝาก needs an address; an outright sale never sends one.
          ...(requireAddress && input.contact.address ? { address: input.contact.address } : {}),
        },
      }),
    });
    let response = await send();
    // Atlas's session token outlived (12 hours): sign in again once and resend.
    if (response.status === 401 && await reauthenticateLiff()) response = await send();
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    const result = (await response.json()) as { id?: unknown; reference?: unknown; submittedAt?: unknown; lineNotified?: unknown };
    if (typeof result.id !== "string" || typeof result.reference !== "string" || !/^ATL-[A-F0-9]{8}$/.test(result.reference) ||
        typeof result.submittedAt !== "string") throw new Error("Unexpected response");
    return {
      id: result.id,
      reference: result.reference,
      sessionId: input.sessionId,
      state: "submitted",
      submittedAt: result.submittedAt,
      lineConnection: "line_connected",
      lineNotified: result.lineNotified === true,
      context: toReceiptContext(input.context),
    };
  }
}
