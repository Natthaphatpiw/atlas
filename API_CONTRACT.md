# Atlas Service Boundaries and Backend Handoff

## A. Current frontend service boundaries

No HTTP backend is implemented. Pages currently instantiate mock adapters; Device consumes `mockDevices` directly. Service interfaces provide replacement boundaries, but the current frontend is not fully isolated from concrete mocks.

### ValuationService

```ts
interface MockValuationResult {
  minPrice: number;
  maxPrice: number;
  currency: "THB";
}

interface ValuationService {
  getDeviceCatalog(): Promise<Device[]>;
  getConditionQuestions(deviceCategory: Device["category"]): Promise<ConditionQuestion[]>;
  estimateValue(session: ValuationSession): Promise<EstimatedPrice>;
  getMockValuationResult(session: ValuationSession): Promise<MockValuationResult>;
}
```

- `getDeviceCatalog` exists, but Device currently imports the fixture catalog directly.
- `getConditionQuestions` returns category-specific questions. Condition uses them for the questionnaire; Lead also checks required answers against them.
- `getMockValuationResult` is the active result boundary used by Result, Lead and Handoff. It returns a fixed THB range of 24500–27000 and does not calculate from session inputs.
- `estimateValue` is unused formula-based demo logic. It is not an approved production valuation engine and must not be adopted as one by inference.
- The active range is preliminary and non-binding. There is no persisted result ID, approved quote, production confidence, provenance or expiry contract.

### LeadService

```ts
interface LeadService {
  submitLead(input: Omit<Lead, "id" | "createdAt">): Promise<Lead>;
}
```

Current UI input is `{ sessionId, fullName, phone, consentToContact, source: "atlast_web" }`. Name is trimmed, phone is normalized and validated, and consent is required. Although the domain permits optional email, the form does not collect it.

The mock returns the input plus a mock ID and browser timestamp. It does not persist the Lead. The page ignores the returned record and advances local status to `lead_collected`; it does not save a durable lead identifier. Future submission success must be defined in terms of server persistence, not this mock behavior.

### Current error and recovery behavior

These are adapter/UI behaviors, not a finalized HTTP contract:

- Invalid form input is blocked with inline Thai errors; Lead focuses the first invalid field and guards repeated submission.
- Lead catches context-loading and submission failures and offers generic recovery/retry UI.
- Handoff catches context-preparation failures and offers recovery.
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
| `condition_question_answered` | Continue accepts an answer, immediately before the session-helper save |
| `condition_section_completed` | Final-question Continue saves completion; not a separate event on review Continue |
| `expected_price_entered` | Valid Expected Price Continue saves the value; in-app Back may save without emitting this event |
| `valuation_result_viewed` | Mock range loads for display on Result |
| `seller_proceeded` | Result Continue |
| `lead_submitted` | Mock Lead submission succeeds and local status advances |
| `handoff_started` | Handoff context is prepared and local status becomes ready; not a LINE button click or delivery |

Current Condition events do not include a session ID or question/option ID. A declared field or question `analyticsId` does not imply it is emitted. Genuine page remounts can emit another view/start-of-screen event; there is no global exactly-once delivery guarantee.

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
| `GET /condition-questions?category={deviceCategory}` | Retrieve applicable questions |
| `POST /valuation/estimate` | Request an estimate under an approved future valuation contract |
| `POST /leads` | Persist a validated lead and return a confirmed record |
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
3. Stable questionnaire/version, question and option identity. Current Thai answer labels are snapshots, not durable canonical identifiers.
4. Authoritative validation of devices, answers, positive safe-integer THB amounts and contact data. Do not trust client scores or completion flags.
5. Durable Lead/session association, submission success and retry/idempotency semantics.
6. Consent evidence: state, wording/version and authoritative timestamp. Retention/legal policy details are not specified.
7. Server-owned lifecycle milestones and invalidation when earlier inputs change, distinguished from browser progress.
8. A valuation contract that distinguishes fixed mock ranges from future production output. Production methodology, confidence, provenance and expiry remain unresolved.

A sensible dependency order is identity/validation decisions → session persistence → Lead and consent persistence → adapter wiring and failure handling. Production valuation replacement and LINE/Astly integration require separate decisions and authorization.

Final database technology/schema, LINE identity/token design and delivery acknowledgement, final Astly payload, payment, KYC and matching remain unresolved/future. This document does not authorize Supabase or any backend implementation by itself.
