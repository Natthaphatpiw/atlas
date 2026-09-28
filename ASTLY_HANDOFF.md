# Astly Valuation Integration and Future LINE Continuation

## Current Frontend MVP boundary

Atlas currently implements a seller valuation/contact journey ending at a mock request receipt and prototype Connect LINE screen. It has:

- a preliminary-valuation integration with Astly's demo estimate API (below), used only by the Result step;
- no real LINE integration or generic LINE redirect;
- no durable request/contact or operational Handoff record;
- no LINE identity/token or delivery acknowledgement;
- no operational Astly handoff: requests, contacts, items and receipts are never sent to Astly;
- no payment, KYC or matching;
- no Atlas-owned or approved production valuation algorithm; the preliminary figure is Astly's demo estimate.

The valuation context currently includes a seller-reported Device Assessment, Astly's preliminary estimate, the seller's expected price and structured `transactionIntent` (`outright_sale` or `sell_and_repurchase`). The assessment is preliminary browser-local input, not an Atlas or Apple verified inspection. A future physical verification may confirm or override it before a final price; no verified inspection schema or downstream payload is defined. Sell-and-repurchase is intent only and defines no financial or contract terms.

Seller Contact sends name, phone, optional unverified LINE-ID text and consent only to an in-memory mock service. The browser stores a non-PII receipt containing safe valuation context, assessment review metadata, a mock reference and `prototype_pending` LINE state; it does not retain contact data or consent evidence. Its valuation context keeps only the price (`minPrice`, `maxPrice`, `currency`, `source`), not Astly's job, breakdown or priced inputs. The Connect LINE CTA is a prototype interaction only. `request_submitted` means that receipt exists locally, and `line_connect_started` describes the CTA interaction, not external delivery. No fake redirect/completion analytics are emitted.

## Current Astly valuation integration

Browser → Atlas server routes (`POST /api/valuation/estimate`, `GET /api/valuation/estimate/[jobId]`) → Astly demo estimate API (`POST /api/demo/estimate`, `GET /api/demo/estimate/{jobId}` on `ASTLY_API_BASE_URL`, default `https://www.astly.co`).

- Atlas authenticates server-to-server with `ASTLY_DEMO_API_KEY` (issued by Astly; one of Astly's `DEMO_ESTIMATE_API_KEYS`). The browser never calls Astly and never sees the key. Without the key, Result shows a temporary-unavailable error; there is no mock fallback.
- Each call carries an opaque visitor ID: an HMAC of the client network (IPv4 address or IPv6 /64) keyed by the Atlas-only `ATLAS_VISITOR_SECRET`, which Astly never holds. Astly scopes job ownership and per-visitor limits by it (defaults 3 estimates per 10 minutes and 10 per day), alongside global caps and a demo spend ceiling, and never receives the IP. Polling uses the visitor recorded in a signed ticket issued when the job started, so a network change does not orphan the job.
- Atlas sends item type, brand, model, capacity/specs and Astly's eight-item seller condition checklist, derived from the seller-reported answers after server-side re-validation. It sends no colour, photos, name, phone, LINE ID, consent, expected price, transaction intent, session ID or request reference. API_CONTRACT.md documents the request, checklist mapping and error handling.
- Astly returns a point `estimatedPrice` (market reference price × loan-to-value × condition, snapped to 500 THB), with `marketPrice`, `pawnPrice`, `condition`, `confidence`, `productName` and Thai calculation strings. Atlas stores it in the browser session only.
- Per Astly's contract, demo jobs have no photos or AI condition scoring, never receive an attestation and cannot back an Astly loan request. Items Astly cannot price fail with `demo_estimate_unavailable` instead of reaching an Astly operator.

This integration is limited to a non-binding preliminary estimate for anonymous demo visitors. It is not an operational handoff, does not create an Astly pawner, contract or lead, and does not settle the seller-facing meaning of a loan-to-value-based figure in a seller valuation product.

## Future conceptual sequence

Atlas (with Astly's preliminary estimate) → future LINE OA continuation → possible future operational/Astly integration.

The LINE and operational steps are a conceptual boundary, not an implemented integration or settled delivery design. Atlas remains a separate product. Possible Astly responsibilities concern downstream operational handling and need agreement when that integration is commissioned.

## Provisional payload considerations

Earlier candidate fields were `source: "atlast"`, `sessionId`, optional `leadId`, optional `deviceId`, optional `estimatedAmount`, optional `expectedAmount`, and `createdAt`.

These are not a finalized contract:

- Future persisted identifiers and authoritative timestamps must come from the backend/API, not browser-generated mock IDs.
- The MVP has no retained durable `leadId` or backend request ID to send. Its `MOCK-...` receipt reference is not an integration identifier. Astly's demo `jobId` identifies an estimate job owned by an anonymous demo visitor; it is not an Astly request, lead or loan identifier.
- Device/configuration and seller-assessment references need stable canonical identities and version treatment. Seller-reported answers must remain distinct from any future verified inspection.
- A single `estimatedAmount` is not settled. The session stores Astly's point estimate as `{ minPrice, maxPrice, currency }` with equal bounds, plus `source: "astly"` and Astly's result details. Whether a handoff should carry that figure, Astly's market reference price or the job ID, and Atlas-side provenance and expiry, remain unresolved.
- Any transferred data requires an explicit purpose and validated typed boundary; a generic payload placeholder does not define what should be sent.

LINE identity/token design, delivery acknowledgement, the final operational Astly payload and responsibility boundaries remain future decisions. Payment, KYC and matching are not implied requirements of the current Atlas MVP.

## Guardrails

Atlas calls Astly only for the preliminary estimate, only from its own server routes, and never with contact data, photos or request receipts. No LINE integration exists. The estimate integration and backend persistence do not authorize an operational Astly or LINE integration. Define and approve those contracts separately; do not infer readiness from local session statuses, a completed Astly estimate or mock request success. See API_CONTRACT.md for the separate Backend Developer handoff.
