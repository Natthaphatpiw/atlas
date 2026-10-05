import type { MockRequestReceipt, RequestContext, RequestReceiptContext, ValuationRequestInput } from "@/domain/valuation-request";
import type { RequestService } from "@/services/request-service";
import { contactErrors } from "@/lib/seller-contact";

export class MockRequestService implements RequestService {
  async submitRequest(input: ValuationRequestInput): Promise<MockRequestReceipt> {
    if (Object.values(contactErrors(input.contact)).some(Boolean)) throw new Error("Invalid contact");
    if (!input.context.assessment.reviewedAt) throw new Error("Invalid request context");
    // No network call, durable request, contact storage, or LINE identity.
    const id = crypto.randomUUID();
    return {
      id: `mock-request-${id}`,
      reference: `MOCK-${id.slice(0, 8).toUpperCase()}`,
      sessionId: input.sessionId,
      state: "submitted",
      submittedAt: new Date().toISOString(),
      lineConnection: "prototype_pending",
      context: toReceiptContext(input.context),
    };
  }
}

/** The request context a receipt keeps: the assessment's identity, not its answers. */
export function toReceiptContext(context: RequestContext): RequestReceiptContext {
  return {
    device: structuredClone(context.device),
    assessment: {
      definitionId: context.assessment.definitionId,
      version: context.assessment.version,
      reviewedAt: context.assessment.reviewedAt!,
    },
    preliminaryValuation: structuredClone(context.preliminaryValuation),
    expectedPrice: structuredClone(context.expectedPrice),
    transactionIntent: context.transactionIntent,
  };
}
