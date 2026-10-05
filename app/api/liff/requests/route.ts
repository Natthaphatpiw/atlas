import type { TransactionIntent } from "@/domain/types";
import { parseValuationSelection } from "@/lib/estimate-request";
import { contactErrors, normalizeSellerContact } from "@/lib/seller-contact";
import { atlasRpc, updateSaleRequest } from "@/lib/server/atlas-db";
import { getAstlyEstimate } from "@/lib/server/astly-client";
import { friendStatusOf, pushLineMessages, saleRequestConfirmationMessage } from "@/lib/server/line-messaging";
import { readLiffSession } from "@/lib/server/liff-auth";
import { allowEvents, clockOffsetMs, isVisitId, sanitizeSnapshot } from "@/lib/server/liff-events";
import { estimateInputHash, readEstimateTicketClaims, readPriceReceipt, type PriceReceipt } from "@/lib/server/visitor";
import { formatDeviceSpecs } from "@/lib/valuation-format";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_PRICE = 100_000_000;
const NO_STORE = { "Cache-Control": "no-store" };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const price = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= MAX_PRICE ? value : undefined;
const reject = (status: number, code: string) => Response.json({ code }, { status, headers: NO_STORE });

interface SubmittedRow {
  request_id: string;
  reference: string;
  created: boolean;
  created_at: string;
  line_push_status: string;
}

/**
 * The Astly price for this exact device and assessment, as Atlas saw it: from
 * the signed price receipt issued while polling, else by re-reading the job
 * with its ticket (Astly keeps jobs two hours). Both are Atlas-signed and
 * bound to the priced input, so a browser cannot claim another job's price.
 * Null when neither confirms it; the browser's price is then stored as
 * unverified and never quoted back to the user.
 */
async function verifiedEstimate(jobId: string | undefined, estimate: Record<string, unknown>, inputHash: string): Promise<PriceReceipt | null> {
  if (!jobId) return null;
  const receipt = readPriceReceipt(estimate.priceReceipt, jobId, inputHash);
  if (receipt) return receipt;
  if (typeof estimate.ticket !== "string") return null;
  const claims = readEstimateTicketClaims(estimate.ticket, jobId);
  if (!claims || claims.inputHash !== inputHash) return null;
  try {
    const state = await getAstlyEstimate(jobId, claims.visitor);
    return state.status === "COMPLETED" && state.result && state.result.estimatedPrice > 0 ? state.result : null;
  } catch {
    return null;
  }
}

// Stores a LIFF user's sale request ("interested"), then confirms it to them in LINE.
export async function POST(request: Request) {
  const session = readLiffSession(request);
  if (!session) return reject(401, "unauthorized");
  const text = await request.text().catch(() => "");
  if (!text || text.length > MAX_BODY_BYTES) return reject(400, "invalid_request");
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return reject(400, "invalid_request");
  }
  if (!isRecord(body)) return reject(400, "invalid_request");

  // The catalog and current assessment definition decide the device and what Astly prices, as for estimates.
  const selection = parseValuationSelection({ deviceId: body.deviceId, specs: body.specs, assessment: body.assessment });
  const rawContact = isRecord(body.contact) ? body.contact : {};
  const contact = normalizeSellerContact({
    fullName: typeof rawContact.fullName === "string" ? rawContact.fullName.slice(0, 200) : "",
    phone: typeof rawContact.phone === "string" ? rawContact.phone.slice(0, 40) : "",
    consentToContact: rawContact.consentToContact === true,
  });
  const expectedPrice = price(body.expectedPrice);
  const intent: TransactionIntent | undefined =
    body.transactionIntent === "outright_sale" || body.transactionIntent === "sell_and_repurchase" ? body.transactionIntent : undefined;
  const now = Date.now();
  const offset = clockOffsetMs(body.sentAt, now);
  const snapshot = sanitizeSnapshot(body.session, offset, now);
  if (!selection || Object.values(contactErrors(contact)).some(Boolean) || contact.fullName.length > 120 ||
      !expectedPrice || !intent || !snapshot || !isVisitId(body.visitId)) {
    return reject(400, "invalid_request");
  }
  if (!allowEvents(`submit:${session.userId}`, 1, now, 20, 60 * 60 * 1000)) return reject(429, "rate_limited");

  const estimate = isRecord(body.estimate) ? body.estimate : {};
  const jobId = typeof estimate.jobId === "string" && /^[0-9a-f-]{16,64}$/i.test(estimate.jobId) ? estimate.jobId : undefined;
  const verified = await verifiedEstimate(jobId, estimate, estimateInputHash(selection.input));
  const estimatedPrice = verified?.estimatedPrice ?? price(estimate.estimatedPrice);
  if (!estimatedPrice) return reject(400, "invalid_request");
  // The app requires the Atlas OA as a friend before use; enforce it here too. Unknown (no token) passes.
  if (await friendStatusOf(session) === false) return reject(403, "not_friend");

  const { device } = selection;
  const productName = device.model.toLowerCase().startsWith(device.brand.toLowerCase()) ? device.model : `${device.brand} ${device.model}`;
  const productDetails = formatDeviceSpecs(device);
  const specs = { ...(device.variant ? { variant: device.variant } : {}), ...device.specs } as Record<string, string>;
  // A verified price comes with Atlas's own reading of the condition: Astly's
  // multiplier and the checklist faults derived from the validated answers.
  const condition = verified
    ? {
      condition_score: Math.round(Math.min(1, Math.max(0, verified.condition)) * 100),
      condition_deductions: Object.entries(selection.input.conditionChecks).filter(([, fault]) => fault).map(([key]) => ({ key })),
    }
    : { condition_score: snapshot.condition_score, condition_deductions: snapshot.condition_deductions };
  // Server-checked values replace the browser's in the stored snapshot.
  const sessionSnapshot = {
    ...snapshot,
    device_id: device.id,
    device_category: device.category,
    device_brand: device.brand,
    device_model: device.model,
    device_specs: specs,
    expected_price: expectedPrice,
    transaction_intent: intent,
    ...(verified ? { estimated_price: verified.estimatedPrice, market_price: verified.marketPrice, pawn_price: verified.pawnPrice, ...condition } : {}),
  };

  let row: SubmittedRow | undefined;
  try {
    const rows = await atlasRpc<SubmittedRow[]>("atlas_submit_sale_request", {
      ingest: { user: { line_user_id: session.userId }, visit_id: body.visitId, session: sessionSnapshot, events: [] },
      request: {
        contact_name: contact.fullName,
        contact_phone: contact.phone,
        product_name: productName,
        device_id: device.id,
        device_category: device.category,
        device_brand: device.brand,
        device_model: device.model,
        device_specs: specs,
        ...condition,
        astly_job_id: jobId,
        estimate_verified: Boolean(verified),
        estimated_price: estimatedPrice,
        market_price: verified?.marketPrice ?? snapshot.market_price,
        pawn_price: verified?.pawnPrice ?? snapshot.pawn_price,
        expected_price: expectedPrice,
        transaction_intent: intent,
      },
    });
    row = rows[0];
  } catch {
    return reject(503, "unavailable");
  }
  if (!row) return reject(503, "unavailable");

  let lineNotified = row.line_push_status === "sent";
  // A retry after a failed or interrupted push sends it again; LINE's retry key keeps it to one message.
  if (!lineNotified) {
    const message = saleRequestConfirmationMessage({
      reference: row.reference,
      productName,
      productDetails,
      transactionIntent: intent,
      estimatedPrice: verified ? estimatedPrice : null,
      expectedPrice,
      submittedAt: new Date(row.created_at),
    });
    // A local mock user is not a real LINE user: LINE validates the message instead of sending it.
    const push = await pushLineMessages(session.userId, [message], { retryKey: row.request_id, dryRun: session.mock });
    lineNotified = push.status === "sent";
    await updateSaleRequest(row.request_id, push.status === "sent"
      ? { line_push_status: "sent", line_pushed_at: new Date().toISOString(), line_push_error: null }
      : { line_push_status: push.status, line_push_error: push.error }).catch(() => undefined);
  }

  return Response.json({ id: row.request_id, reference: row.reference, submittedAt: row.created_at, lineNotified }, { status: row.created ? 201 : 200, headers: NO_STORE });
}
