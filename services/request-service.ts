import type { MockRequestReceipt, ValuationRequestInput } from "@/domain/valuation-request";

export interface RequestService {
  submitRequest(input: ValuationRequestInput): Promise<MockRequestReceipt>;
}
