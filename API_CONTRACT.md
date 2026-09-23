# Atlas Service Boundaries and Backend Handoff

## A. Current frontend service boundaries

No HTTP backend is implemented. Pages currently instantiate mock adapters. Device requests the catalog through `ValuationService`; the mock adapter reads the frontend data modules, preserving the replacement boundary for a future backend catalog.

### ValuationService

```ts
interface MockValuationResult {
  minPrice: number;
  maxPrice: number;
  currency: "THB";
}

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
- `getDeviceAssessment` returns the applicable data-driven seller assessment for the selected device. Its current mock fixture provides detailed iPhone coverage and a basic non-iPhone fallback. It is not a verified inspection or a pricing rule.
- `getConditionQuestions` is a legacy v1 fixture API. The v2 assessment and its prerequisites do not use it.
- `getMockValuationResult` is the active result boundary used by Result and Seller Contact; Request Submitted displays the saved range snapshot. It returns a fixed THB range of 24500–27000 and does not calculate from session inputs.
- `estimateValue` is unused formula-based demo logic. It rejects v2 seller assessments and is not an approved production valuation engine.
- The active range is preliminary and non-binding. There is no persisted result ID, approved quote, production confidence, provenance or expiry contract.

### RequestService

```ts
interface RequestService {
  submitRequest(input: ValuationRequestInput): Promise<MockRequestReceipt>;
}
```

Current UI input is `{ sessionId, context, contact, source: "atlast_web" }`. `context` holds device, assessment, expected price and preliminary range; `contact` holds `{ fullName, phone, lineIdProvided?, consentToContact: true }`. Name is trimmed, phone is normalized and validated, and consent is required. `lineIdProvided` is unverified seller-entered text, not a LINE identity or integration credential.

The mock returns a non-PII `MockRequestReceipt` with a UUID-style mock ID, `MOCK-...` reference, browser timestamp, `prototype_pending` LINE state and a request-context snapshot. It does not persist the request. The browser session saves the receipt and advances to `request_submitted`, but never saves name, phone, LINE ID or consent evidence. Future submission success must be defined in terms of server persistence, not this mock behavior.

`LeadService` and its domain type remain legacy compatibility boundaries and are unused by the current flow.

### Current error and recovery behavior

These are adapter/UI behaviors, not a finalized HTTP contract:

- Invalid form input is blocked with inline Thai errors; Seller Contact focuses the first invalid field and guards repeated submission.
- Seller Contact catches context-loading and submission failures and offers generic recovery/retry UI.
- Request Submitted validates its local receipt and offers prerequisite recovery; an unreadable existing receipt is locked with an explicit fresh-session boundary.
- Result currently has no equivalent rejected-result promise handler. Replacing its always-resolving mock requires an agreed failure/retry behavior.
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
| `expected_price_entered` | Valid Expected Price Continue saves the value; in-app Back may save without emitting this event |
| `valuation_result_viewed` | Mock range loads for display on Result |
| `seller_proceeded` | Result Continue |
| `seller_contact_viewed` | Valid Seller Contact form becomes available |
| `valuation_request_submitted` | Mock request submission succeeds and its non-PII receipt is saved locally |
| `line_connect_viewed` | Valid request receipt shown on the Connect LINE screen |
| `line_connect_started` | Prototype Connect LINE CTA interaction; not a redirect, connection or delivery |

Assessment events may include the session/device context, `questionId` and `assessmentVersion`; answer values and option IDs are not emitted. They never include contact PII, raw LINE data or claimed verification results. Genuine page remounts can emit another view/start-of-screen event; there is no global exactly-once delivery guarantee.

Declared but not emitted:

- `valuation_calculated`: intentionally absent because the active result is a fixed fixture, not a calculation.
- `seller_declined`: no explicit decline action exists in the current flow.
- `line_redirect_clicked` and `handoff_completed`: absent because no real redirect or completed external handoff exists.

Do not fabricate backend, valuation calculation or LINE events to fill the declared event list. Analytics vendor selection remains unresolved.

## B. Provisional future API contract

The following endpoints are earlier proposals, not implemented routes, approved final request contracts or instructions to build every endpoint now:

| Proposed endpoint | Provisional responsibility |
| --- | --- |
| `GET /devices` | Retrieve available catalog data |
| `GET /device-assessment?deviceId={deviceId}` | Retrieve an applicable versioned seller-assessment definition |
| `GET /condition-questions?category={deviceCategory}` | Earlier legacy v1-question proposal |
| `POST /valuation/estimate` | Request an estimate under an approved future valuation contract |
| `POST /leads` | Earlier proposal; the future request/contact endpoint and privacy contract remain unresolved |
| `POST /handoff/line` | Prepare a future LINE continuation, only when separately authorized |

The current service promises are the concrete frontend boundary. Transport mapping, ownership, identifiers, validation, retries and response use must be resolved before implementation. No additional endpoints or database schema are prescribed here.

Earlier envelope examples remain provisional:

```ts
// Future examples only; current adapters return domain objects directly.
{ data: unknown, meta: { requestId: string, generatedAt: string } }
{ error: { code: string, message: string, details: unknown[] } }
```

## Backend Developer handoff

Implement future persistence/API behind the existing frontend boundaries. Preserve the seller journey and recovery behavior; do not interpret a local progress flag as proof of a durable business action.

Resolve before or during the relevant backend work:

1. Canonical persisted session ownership and server-issued identity/timestamps. Anonymous lifetime, resume duration and authentication remain undecided.
2. Stable device/catalog category, brand, model and configuration/spec identity; define catalog/version treatment without using presentation labels as keys.
3. Stable seller-assessment definition/version, question and option identity, structured answer values and conditional applicability. Thai answer labels are not durable canonical identifiers. A future verified physical inspection must remain distinguishable from seller-reported answers.
4. Authoritative validation of devices, seller-reported answers, positive safe-integer THB amounts and contact data. Do not trust client scores, completion flags or seller reports as verified condition.
5. Durable request/session association, contact PII handling, submission success and retry/idempotency semantics.
6. Consent evidence: state, wording/version and authoritative timestamp. Retention/legal policy details are not specified.
7. Server-owned lifecycle milestones and invalidation when earlier inputs change, distinguished from browser progress.
8. A valuation contract that distinguishes fixed mock ranges from future production output. Production methodology, confidence, provenance and expiry remain unresolved.

A sensible dependency order is identity/validation decisions → session persistence → request/contact and consent persistence → adapter wiring and failure handling. Production valuation replacement and LINE/Astly integration require separate decisions and authorization.

Final database technology/schema, LINE identity/token design and delivery acknowledgement, final Astly payload, payment, KYC and matching remain unresolved/future. This document does not authorize Supabase or any backend implementation by itself.
