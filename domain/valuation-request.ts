import type { SellerAssessment } from "./assessment";
import type { Device, ExpectedPrice, PreliminaryValuation, TransactionIntent } from "./types";

/** Where the device would be collected and the ขายฝาก contract arranged. */
export interface SellerAddress {
  /** House number, building, road, sub-district, district and province, as typed. */
  line: string;
  /** Thai postcode, five digits. */
  postcode: string;
}

export interface SellerContact {
  fullName: string;
  phone: string;
  /** Unverified seller-entered contact text, never a LINE platform identity. */
  lineIdProvided?: string;
  /** Required for sell_and_repurchase (ขายฝาก) only; never collected for an outright sale. */
  address?: SellerAddress;
  consentToContact: boolean;
}

export interface RequestContext {
  device: Device;
  assessment: SellerAssessment;
  preliminaryValuation: PreliminaryValuation;
  expectedPrice: ExpectedPrice;
  transactionIntent: TransactionIntent;
}

export interface ReceiptAssessmentSnapshot {
  definitionId: string;
  version: number;
  reviewedAt: string;
}

export interface RequestReceiptContext {
  device: Device;
  assessment: ReceiptAssessmentSnapshot;
  preliminaryValuation: PreliminaryValuation;
  expectedPrice: ExpectedPrice;
  transactionIntent: TransactionIntent;
}

/** Transient mock submission only; contact is not retained in browser storage. */
export interface ValuationRequestInput {
  sessionId: string;
  context: RequestContext;
  contact: SellerContact;
  source: "atlast_web";
}

/**
 * Receipt kept in the browser session. On the web it is a mock (reference
 * MOCK-…, nothing stored on a server). In the LINE LIFF app it mirrors a
 * request stored by Atlas's server (reference ATL-…), and lineNotified says
 * whether the LINE confirmation message was sent.
 */
export interface MockRequestReceipt {
  id: string;
  reference: string;
  sessionId: string;
  state: "submitted";
  submittedAt: string;
  lineConnection: "prototype_pending" | "line_connected";
  lineNotified?: boolean;
  context: RequestReceiptContext;
}
