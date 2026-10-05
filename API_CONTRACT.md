# Atlas Service Boundaries and Backend Handoff

## A. Current frontend service boundaries

Atlas has no persistent backend. Its only HTTP routes are two server route handlers that proxy Astly's demo estimate API for the Result step (see "Astly estimate boundary" below); they store nothing. Other pages instantiate mock adapters. Device requests the catalog through `ValuationService`; the mock adapter reads the frontend data modules, preserving the replacement boundary for a future backend catalog.

### ValuationService

```ts
type MockValuationResult = PreliminaryValuation; // { minPrice, maxPrice, currency: "THB", source?, astly? }

interface ValuationService {
  getDeviceCatalog(): Promise<CatalogDevice[]>;
  getDeviceAssessment(device: Device): Promise<AssessmentDefinition>;
  /** Legacy v1 fixture API; not used by the seller assessment. */
  getConditionQuestions(deviceCategory: Device["category"]): Promise<ConditionQuestion[]>;
  estimateValue(session: ValuationSession): Promise<EstimatedPrice>;
  getMockValuationResult(session: ValuationSession): Promise<MockValuationResult>;
}
```

- `getDeviceCatalog` returns research-backed frontend mock records with catalog-only brand, release-order, spec-option and provenance metadata. The Device page persists only the compatible `Device` snapshot. A future backend may own catalog records behind this method; database technology and transport are not selected here.
- `getDeviceAssessment` returns the applicable data-driven seller assessment for the selected device. Its current mock fixture provides definitions for iPhone (`seller_reported_iphone_v1`), tablets (`seller_reported_tablet_v1`), MacBooks (`seller_reported_macbook_v1`) and Mac desktops (`seller_reported_mac_desktop_v1`). Other phones get a basic fallback (`seller_reported_basic_v2`) that covers every item on Astly's seller condition checklist. It is not a verified inspection or a pricing rule.
- `getConditionQuestions` is a legacy v1 fixture API. The v2 assessment and its prerequisites do not use it.
- `getMockValuationResult` still returns the fixed THB range 24500–27000, but Result no longer calls it. It is retained as a fixture method, not the active Result boundary.
- `estimateValue` is unused formula-based demo logic. It rejects v2 seller assessments and is not an approved production valuation engine.

Device Selection supports browser-memory-only optional photo previews. They are deliberately absent from `ValuationRequestInput`, `RequestContext`, analytics, session storage, the mock receipt and the Astly estimate request. A future backend request may support `devicePhotos[]` after product-approved upload orchestration and storage references are designed; this MVP defines neither mechanism nor vendor.

### Astly estimate boundary (Result)

Result is the only screen that makes an API call. The browser client `adapters/astly/estimate-client.ts` calls Atlas's own routes; `lib/server/astly-client.ts` calls Astly's demo estimate API (`POST /api/demo/estimate`, `GET /api/demo/estimate/{jobId}`) with `Authorization: Bearer <ASTLY_DEMO_API_KEY>` and `X-Demo-Visitor: <HMAC of client IP>`, a 15-second timeout and no caching. The browser never calls astly.co and never receives the key. The Astly-side contract is owned by Astly (`DEMO_ESTIMATE_API.md` in the Astly codebase).

```ts
// Browser → Atlas (lib/estimate-request-body.ts)
interface EstimateRequestBody {
  deviceId: string;
  specs: Device["specs"];
  assessment: { definitionId: string; version: number; answers: AssessmentAnswer[] };
}

// Atlas → browser (domain/astly.ts)
interface EstimateJobAccepted { jobId: string; status: AstlyEstimateJobStatus; pollAfterMs: number; condition: AstlyConditionAssessment }
interface EstimateJobState { jobId: string; status: AstlyEstimateJobStatus; pollAfterMs: number; message?: string; result?: AstlyEstimateResult; error?: string; code?: string }
interface EstimateApiError { error: string; code: string; retryAfterSeconds?: number }
type AstlyEstimateJobStatus = "QUEUED" | "PROCESSING" | "RETRYING" | "COMPLETED" | "FAILED" | "CANCELLED";
```

| Atlas route | Behavior |
| --- | --- |
| `POST /api/valuation/estimate` | Accepts a JSON body up to 32KB and returns `202` with `EstimateJobAccepted` (Astly's job ID and its checklist score/deductions) |
| `GET /api/valuation/estimate/[jobId]` | Returns `EstimateJobState`; `result` only when `COMPLETED`, `error`/`code` only when `FAILED` or `CANCELLED`. A `COMPLETED` state also carries `priceReceipt`, an Atlas-signed record of the price for the priced input, which the LINE LIFF app presents when it submits a request (LINE_LIFF.md) |

Server validation (`lib/estimate-request.ts`) is the authority for what is priced. `deviceId` must be a catalog entry and every spec value must be one of that entry's catalog options. The assessment must match the current definition ID/version and be complete for that device; at most 100 answers are accepted, and the source is always treated as `seller_reported`. Browser-supplied scores, labels, statuses and prices are never trusted. Watch, audio and other categories cannot be mapped and are rejected as `invalid_request`.

Atlas sends Astly only the item description and checklist (`lib/astly-estimate-input.ts`). Each category maps as follows:

| Device | Sent as | Extra fields |
| --- | --- | --- |
| Phone | `Apple`/`iPhone`, or `โทรศัพท์มือถือ` | — |
| Tablet | `Apple`/`iPad`, or `แท็บเล็ต` | iPads add network and chip as free-text `appleSpecs` |
| MacBook | `Apple`/`MacBook` | Chip, RAM, SSD and display size as `appleSpecs` |
| Mac desktop | `Apple` with `iMac`, `Mac mini`, `Mac Studio` or `Mac Pro` (from the model name) | Same `appleSpecs` as MacBook |
| Other laptop | `โน้ตบุค` | `cpu`, `ram`, `storage`, `screenSize` |

Every request carries brand, the catalog model name and the selected storage as `capacity`. Every catalog device maps to a category Astly accepts; `tests/astly.test.cjs` checks this. It sends no colour, phone variant, photos, contact data, expected price, transaction intent or session ID.

Only applicable answers count (the same pruning as the assessment), and `unknown` or skipped answers never set a checklist item:

| Astly checklist item | Set when the seller reports |
| --- | --- |
| `screenCrack` | `display_glass_condition` is `minor`, `noticeable` or `severe` |
| `screenLineDeadPixel` | `display_works`, `display_has_no_defects`, `built_in_display_works` or `built_in_display_has_no_defects` is `no` |
| `touchIssue` | `touchscreen_works` or `stylus_works` is `no` |
| `batteryIssue` | `battery_service_warning` or `battery_degraded` is `yes`, `battery_holds_charge` is `no`, or `battery_health_percentage` is below 80 |
| `bodyDamage` | Damage-only questions (`exterior_condition`, `frame_bending_condition`, `chassis_bending_condition`, and the tablet `frame_body_condition`) at any level. Questions that also cover scratches or wear (iPhone `back_glass_condition`/`frame_body_condition`, `back_cover_condition`, `case_body_condition`, `hinge_condition`, `keyboard_trackpad_condition`) at `noticeable` or `severe` |
| `cameraIssue` | `front_camera_works`, `rear_camera_works`, `cameras_work`, `camera_works` or `face_id_works` is `no`, or `camera_lens_condition` is `noticeable` or `severe` |
| `portButtonIssue` | Any of these is `no`: buttons, haptics, charging (wired, wireless, port), ports, external display output, keyboard, trackpad, Touch ID, speakers, microphones, Wi‑Fi, Bluetooth, cellular or `buttons_ports_work`. Or the desktop `ports_condition` is `noticeable` or `severe` |
| `waterIssue` | `device_powers_on` or `power_stability` is `no`, or `severe_physical_or_liquid_damage` is `yes` |

Other iPhone answers (display scratches, overall usability, repair/parts history, account/security and organization management) are collected but do not affect Astly's estimate. This mapping is an Atlas decision, not an Astly-approved equivalence.

A completed `AstlyEstimateResult` carries `estimatedPrice`, `marketPrice`, `pawnPrice`, `condition` (0–1), `confidence`, `loanToValue`, `productName`, Thai `calculation` strings and `completedAt`. `estimatedPrice` is Astly's lending figure: market reference price × loan-to-value (currently 0.6) × condition multiplier, snapped to a 500 THB step. Sellers never see it. Atlas shows a used-market price, `usedMarketPrice(result)` = `marketPrice × condition` to the nearest 100 THB (`lib/used-price.ts`), and Result stores it as `PreliminaryValuation { minPrice, maxPrice (equal), currency: "THB", source: "astly", astly }`; Expected Price, Seller Contact and Request Submitted reuse that snapshot and render a single price through `lib/valuation-format.ts`. Result does not require or send expected price, transaction intent or photos.

The estimate is preliminary and non-binding. Atlas keeps Astly's job ID only in the browser session. Astly demo results carry no attestation and cannot back an Astly loan request. There is no Atlas-persisted result ID, approved quote, Atlas-owned confidence, provenance or expiry contract; Astly's `confidence` is shown only as a coarse label.

Astly enforces per-visitor limits (defaults 3 per 10 minutes and 10 per day), global caps, a demo-only spend ceiling and a small concurrency lane. An identical request from the same visitor within 10 minutes returns the same Astly job without counting against any limit. The visitor ID (`lib/server/visitor.ts`) is an HMAC-SHA256 of the client network, keyed by the Atlas-only `ATLAS_VISITOR_SECRET` (required: at least 32 chars and different from `ASTLY_DEMO_API_KEY`). The network is the first `x-forwarded-for` address, else `x-real-ip`: an IPv4 address, or an IPv6 address truncated to its /64. Astly never receives the IP. `POST` also returns a `ticket`, an HMAC-signed `{ jobId, visitor, issuedAt, inputHash }` valid for 3 hours (`inputHash` identifies the exact Astly request it priced). Inside the LINE LIFF app, the visitor is an HMAC of the signed-in LINE user instead of the network. `GET` requires it in `X-Estimate-Ticket` and polls as that visitor, so the job survives a network change. Without a valid ticket, `GET` answers 404 `job_not_found`.

### RequestService

```ts
interface RequestService {
  submitRequest(input: ValuationRequestInput): Promise<MockRequestReceipt>;
}
```

Current UI input is `{ sessionId, context, contact, source: "atlast_web" }`. `context` holds device, assessment, the preliminary valuation's price (`minPrice`, `maxPrice`, `currency`, `source`; never the Astly job, breakdown or priced inputs), expected price and stable `transactionIntent`; `contact` holds `{ fullName, phone, lineIdProvided?, consentToContact: true }`. Transaction intent is `outright_sale` or `sell_and_repurchase`. For the latter the UI explains ขายฝาก in plain language when it is selected and shows indicative interest and fees on Seller Contact; final contract terms are confirmed later and are not part of this payload. Name is trimmed, phone is normalized and validated, and consent is required. `lineIdProvided` is unverified seller-entered text, not a LINE identity or integration credential.

The mock returns a non-PII `MockRequestReceipt` with a UUID-style mock ID, `MOCK-...` reference, browser timestamp, `prototype_pending` LINE state and a safe request-context snapshot. The receipt keeps assessment definition/version/review metadata for staleness checks, not the assessment answer array. It does not persist the request. The browser session saves the receipt and advances to `request_submitted`, but never saves name, phone, LINE ID or consent evidence. Future submission success must be defined in terms of server persistence, not this mock behavior.

`LeadService` and its domain type remain legacy compatibility boundaries and are unused by the current flow.

### Current error and recovery behavior

These are adapter/UI behaviors, not a finalized HTTP contract:

- Invalid form input is blocked with inline Thai errors; Seller Contact focuses the first invalid field and guards repeated submission.
- Seller Contact catches context-loading and submission failures and offers generic recovery/retry UI.
- Request Submitted validates its local receipt and offers prerequisite recovery; an unreadable existing receipt is locked with an explicit fresh-session boundary.
- Result shows a progress state while it polls, waiting Astly's `pollAfterMs` (clamped to 2–15 seconds). After 6 minutes without a result it stops with a timeout. A started job is saved in the session and resumed on reload for up to 90 minutes; the browser client also shares one in-flight start per device/assessment identity, so a remount does not start a second estimate.
- Result shows a Thai error with an edit-assessment action and, where retrying can help, a retry action. There is no mock fallback. The Atlas routes map failures as follows:

| Condition | Atlas response | Retry offered |
| --- | --- | --- |
| Malformed/oversized body, non-catalog device or spec, stale or incomplete assessment | `400 invalid_request` | No |
| Astly rejects the item description (`400`) | `422 unsupported_device` | No |
| Astly rate limit (`429`) | `429 rate_limited` with `retryAfterSeconds` and `Retry-After`; Result shows the wait in minutes | Yes |
| `ASTLY_DEMO_API_KEY` unset, key rejected (`401`) or demo API disabled (`404` on start) | `503 estimate_unconfigured` | Yes |
| Network error, 15-second timeout, any other Astly status (for example its own `503`) or a malformed reply | `503 estimate_unavailable` | Yes |
| Invalid job ID format, or Astly `404` for the job | `404 job_not_found`; the saved job is cleared | Yes |
| Job `FAILED`/`CANCELLED` | `200` with Astly's `error`/`code`; the saved job is cleared | Yes, except `demo_estimate_unavailable` (Astly cannot price the item) |
| Job completes with no used-market price (`usedMarketPrice(result) <= 0`: no market price, or condition ~0) | Result shows `no_offer` | No |

- All estimate responses are `Cache-Control: no-store`. Astly's upstream error bodies are not passed through except the `FAILED`/`CANCELLED` job `error` and `code`, truncated.
- Missing prerequisites provide navigation to the relevant earlier step. Browser-local status is not authorization for future server operations.

### AnalyticsService and lifecycle semantics

```ts
interface AnalyticsService {
  track(event: AnalyticsEvent): void;
}
```

Analytics is vendor-neutral. The current mock adapter logs event objects with `console.info`; it does not send them to an analytics vendor. Contact PII, names, phone numbers and contact free text are not emitted. The typed payload allows event name, timestamp, route, session/device identifiers, category, numeric valuation fields and source channel; fields vary by event.

| Emitted event | Current lifecycle point |
| --- | --- |
| `landing_viewed` | Landing mount; a ref prevents duplicates from normal rerenders/effect replay |
| `valuation_started` | Device confirmation creates a new valuation session; unchanged-session continuation does not restart it |
| `device_selected` | Device Continue confirms a configuration, including an unchanged one; repeated clicks during navigation are guarded |
| `condition_question_answered` | Assessment group Continue emits changed answer IDs only after a successful session save |
| `condition_section_completed` | Review confirmation saves the completed seller assessment; one event covers the whole assessment |
| `valuation_calculated` | A polled Astly job completes with a positive used-market price and the valuation is saved to the session; adds `estimatedAmount` (the used-market price shown) and Astly's `confidence`. Restoring an already-saved valuation does not emit it again |
| `valuation_result_viewed` | An Astly valuation is displayed on Result, whether just completed or restored from the session; once per job per page mount |
| `seller_proceeded` | Result Continue toward Expected Price |
| `expected_price_entered` | Valid Expected Price Continue saves the value |
| `transaction_intent_selected` | Explicit Transaction Intent Continue saves and emits the stable machine value only |
| `seller_contact_viewed` | Valid Seller Contact form becomes available |
| `valuation_request_submitted` | Mock request submission succeeds and its non-PII receipt is saved locally |
| `line_connect_viewed` | Valid request receipt shown on the Connect LINE screen |
| `line_connect_started` | Prototype Connect LINE CTA interaction; not a redirect, connection or delivery |

Assessment events may include the session/device context, `questionId` and `assessmentVersion`; answer values and option IDs are not emitted. Transaction Intent analytics may include only `outright_sale` or `sell_and_repurchase`. Valuation events do not include Astly job IDs, checklist deductions, market/pawn prices or calculation strings. Events never include contact PII, raw LINE data, photo data or claimed verification results. Genuine page remounts can emit another view/start-of-screen event; there is no global exactly-once delivery guarantee.

Declared but not emitted:

- `seller_declined`: no explicit decline action exists in the current flow.
- `line_redirect_clicked` and `handoff_completed`: absent because no real redirect or completed external handoff exists.

`valuation_calculated` means Astly completed an estimate for this browser session; it is not an Atlas-owned calculation or a server-confirmed record. Do not fabricate backend or LINE events to fill the declared event list. Analytics vendor selection remains unresolved.

## B. Provisional future API contract

The following endpoints are earlier proposals, not implemented routes, approved final request contracts or instructions to build every endpoint now:

| Proposed endpoint | Provisional responsibility |
| --- | --- |
| `GET /devices` | Retrieve available catalog data |
| `GET /device-assessment?deviceId={deviceId}` | Retrieve an applicable versioned seller-assessment definition |
| `GET /condition-questions?category={deviceCategory}` | Earlier legacy v1-question proposal |
| `POST /valuation/estimate` | Request an estimate under an approved future valuation contract. The implemented `POST /api/valuation/estimate` + `GET /api/valuation/estimate/[jobId]` job/poll proxy to Astly (section A) serves the current demo; it is not that approved contract |
| `POST /leads` | Earlier proposal; the future request/contact endpoint and privacy contract remain unresolved |
| `POST /handoff/line` | Prepare a future LINE continuation, only when separately authorized |

The current service promises are the concrete frontend boundary. Transport mapping, ownership, identifiers, validation, retries and response use must be resolved before implementation. No additional endpoints or database schema are prescribed here.

Earlier envelope examples remain provisional:

```ts
// Future examples only; current adapters and the Astly estimate routes return
// domain objects directly, and estimate errors use { error, code, retryAfterSeconds? }.
{ data: unknown, meta: { requestId: string, generatedAt: string } }
{ error: { code: string, message: string, details: unknown[] } }
```

## Backend Developer handoff

Implement future persistence/API behind the existing frontend boundaries. Preserve the seller journey and recovery behavior; do not interpret a local progress flag as proof of a durable business action.

Resolve before or during the relevant backend work:

1. Canonical persisted session ownership and server-issued identity/timestamps. Anonymous lifetime, resume duration and authentication remain undecided.
2. Stable device/catalog category, brand, model and configuration/spec identity; define catalog/version treatment without using presentation labels as keys.
3. Stable seller-assessment definition/version, question and option identity, structured answer values and conditional applicability. Thai answer labels are not durable canonical identifiers. A future verified physical inspection must remain distinguishable from seller-reported answers.
4. Authoritative validation of devices, seller-reported answers, positive safe-integer THB amounts and contact data. Do not trust client scores, completion flags or seller reports as verified condition. The estimate route already re-validates the device and assessment before calling Astly; request/contact submission and expected price still have no server validation.
5. Durable request/session association, contact PII handling, submission success and retry/idempotency semantics.
6. Consent evidence: state, wording/version and authoritative timestamp. Retention/legal policy details are not specified.
7. Server-owned lifecycle milestones and invalidation when earlier inputs change, distinguished from browser progress.
8. A durable valuation contract. The session already distinguishes fixture ranges (no `source`) from Astly point estimates (`source: "astly"`), but these live only in the browser. Persistence of Astly results (job ID, inputs, checklist, result), Atlas-side provenance and expiry, remain unresolved. (Decided 2026-10-05: the seller-facing figure is the condition-adjusted used-market price, not Astly's loan-to-value-based `estimatedPrice`.) The assessment-to-checklist mapping above is an Atlas decision awaiting product/Astly agreement.

A sensible dependency order is identity/validation decisions → session persistence → request/contact and consent persistence → adapter wiring and failure handling. Changes to the Astly valuation integration beyond the demo contract, and any LINE or operational Astly integration, require separate decisions and authorization.

Final database technology/schema, LINE identity/token design and delivery acknowledgement, the final operational Astly payload, payment, KYC and matching remain unresolved/future. This document does not authorize Supabase or any backend implementation by itself.
