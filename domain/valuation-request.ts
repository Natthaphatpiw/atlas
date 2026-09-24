import type { SellerAssessment } from "./assessment";
import type { Device, ExpectedPrice, PreliminaryValuation, TransactionIntent } from "./types";

export interface SellerContact {
  fullName: string;
  phone: string;
  /** Unverified seller-entered contact text, never a LINE platform identity. */
  lineIdProvided?: string;
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

/** Browser-local receipt, not a durable backend request or consent record. */
export interface MockRequestReceipt {
  id: string;
  reference: string;
  sessionId: string;
  state: "submitted";
  submittedAt: string;
  lineConnection: "prototype_pending";
  context: RequestReceiptContext;
}
