import { LiffRequestService } from "@/adapters/liff/request";
import { MockRequestService } from "@/adapters/mock/request";
import type { MockRequestReceipt, ValuationRequestInput } from "@/domain/valuation-request";
import { isLiffChannel } from "@/lib/flow-navigation";
import type { RequestService } from "@/services/request-service";

/** The web flow keeps its local mock request; the LINE LIFF flow stores real requests. */
export class ChannelRequestService implements RequestService {
  private readonly web = new MockRequestService();
  private readonly liff = new LiffRequestService();

  submitRequest(input: ValuationRequestInput): Promise<MockRequestReceipt> {
    return (isLiffChannel() ? this.liff : this.web).submitRequest(input);
  }
}
