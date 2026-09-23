# Future LINE and Astly Continuation

## Current Frontend MVP boundary

Atlas currently implements a seller valuation/contact journey ending at a prepared continuation screen. It has:

- no real LINE integration or generic LINE redirect;
- no durable Lead or operational Handoff record;
- no LINE identity/token or delivery acknowledgement;
- no Astly integration;
- no payment, KYC or matching;
- no approved production valuation algorithm.

The valuation context currently includes a seller-reported Device Assessment. It is preliminary browser-local input, not an Atlas or Apple verified inspection. A future physical verification may confirm or override it before a final price; no verified inspection schema or downstream payload is defined.

The Handoff button only reveals an intentional LINE availability message. `handoff_ready` means browser-local context is prepared; `handoff_started` describes that screen lifecycle, not external delivery. No fake redirect/completion analytics are emitted.

## Future conceptual sequence

Atlas → future LINE OA continuation → possible future operational/Astly integration.

This is a conceptual boundary, not an implemented integration or settled delivery design. Atlas remains a separate product. Possible Astly responsibilities concern downstream operational handling and need agreement when that integration is commissioned.

## Provisional payload considerations

Earlier candidate fields were `source: "atlast"`, `sessionId`, optional `leadId`, optional `deviceId`, optional `estimatedAmount`, optional `expectedAmount`, and `createdAt`.

These are not a finalized contract:

- Future persisted identifiers and authoritative timestamps must come from the backend/API, not browser-generated mock IDs.
- The MVP has no retained durable `leadId` to send.
- Device/configuration and seller-assessment references need stable canonical identities and version treatment. Seller-reported answers must remain distinct from any future verified inspection.
- A single `estimatedAmount` is not settled: the current UI displays `{ minPrice, maxPrice, currency }`, a fixed mock range. Production valuation methodology, confidence, provenance and expiry remain unresolved.
- Any transferred data requires an explicit purpose and validated typed boundary; a generic payload placeholder does not define what should be sent.

LINE identity/token design, delivery acknowledgement, final Astly payload and responsibility boundaries remain future decisions. Payment, KYC and matching are not implied requirements of the current Atlas MVP.

## Guardrails

No Astly API calls or LINE integration are currently made. Backend persistence does not automatically authorize these integrations. Define and approve their contracts separately; do not infer readiness from local session statuses or mock Lead success. See API_CONTRACT.md for the separate Backend Developer handoff.
