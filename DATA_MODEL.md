# Atlas Data Model

## Current frontend model

The source definitions are in `domain/types.ts`, `domain/assessment.ts`, `domain/valuation-request.ts`, `services/valuation-service.ts` and `lib/valuation-session.ts`. These are frontend contracts, not database schemas.

### Browser-local aggregate

```ts
interface StoredValuationSession {
  session: ValuationSession;
  device: Device;
}
```

This JSON aggregate is stored under `atlast.valuation.session` in browser `sessionStorage`. It supports refresh and navigation in the browser page session; it is not durable backend storage, a cross-device account or a guaranteed resume service. Browser clearing/closing behavior can remove it. The aggregate reader parses JSON and casts types rather than validating the full session schema. The assessment compatibility check validates version/source and the machine-answer shape before the assessment is used.

```ts
interface ValuationSession {
  id: string;
  status: "draft" | "device_selected" | "condition_completed" |
    "expected_price_entered" | "estimated" | "lead_collected" | "handoff_ready" |
    "request_submitted";
  deviceId?: string;
  conditionAnswers: ConditionAnswer[]; // legacy v1 recovery snapshots
  assessment?: SellerAssessment;
  expectedPrice?: ExpectedPrice;
  estimatedPrice?: EstimatedPrice;
  request?: MockRequestReceipt;
  createdAt: string;
  updatedAt: string;
}
```

Session IDs use `session-${Date.now()}` and timestamps use the browser clock. These are local MVP identifiers and times, not server-issued records.

### Device snapshot and selection

```ts
interface Device {
  id: string;
  category: "phone" | "tablet" | "laptop" | "watch" | "audio" | "other";
  brand: string;
  model: string;
  variant?: string;
  specs: {
    storage?: string;
    color?: string;
    network?: string;
    ram?: string;
    displaySize?: string;
  };
  marketHints?: string[];
  createdAt: string;
}
```

There is no separate persisted `DeviceSelection` entity. Category, brand, model ID and selected specs are component state; confirmation stores a Device snapshot alongside the session. Device restores these selections from the saved snapshot.

Identity comparison uses catalog `Device.id` and equality of structured spec keys/values, not model display text. Continuing with identical identity preserves the existing session, answers, price and legitimate later status. A changed device ID or configuration creates a fresh device-selected session without previous answers or price.

The mock catalog data lives in brand-scoped modules under `data/devices/`. `CatalogDevice` extends the persisted `Device` shape with stable `brandId`, release year, explicit family ordering, structured spec options and manufacturer-source metadata. `Device.id` remains the stable model identity, while `model` remains display copy. The current fixture has 81 phones across 11 brands and first-release years 2020–2026, plus the existing MacBook Air. Phones sort by release year descending, explicit family order and then model label; brands sort predictably in the UI.

Mock-only `CatalogDevice.specOptions` uses stable option IDs separate from displayed/stored values. Storage is present for each phone; colors are maintained only where reliable source coverage is available. Source region is recorded as Thailand, global or regional and is not shown to sellers. Regional/global entries can differ from Thailand availability, and this curated catalog is not exhaustive. Confirmation stores only the compatible `Device` snapshot, without catalog metadata or option lists. Model changes clear dependent specs; changing one spec preserves the other selections. Existing iPhone IDs, the iPhone 15 Pro 256GB / Natural Titanium / 5G default and the Galaxy S24 Ultra identity remain compatible with stored sessions. This is frontend UX/development data, not authoritative production inventory or a production schema.

### Ephemeral device photos

Device Selection may hold up to five supported image `File` objects in component memory for local thumbnails. Runtime validation accepts JPEG, PNG and WebP files up to 10MB each. Neither the files, filenames, bytes, Blob objects, object URLs, Base64 data, nor image metadata is written to `sessionStorage`, localStorage, analytics, `RequestContext`, or the mock receipt. Object URLs are revoked when a photo is removed, when the selected device/configuration changes, and when the Device page unmounts. Refresh and route remounting therefore intentionally lose selected photos. Photos do not participate in device identity or downstream invalidation because the mock valuation does not use them.

Future production may represent `devicePhotos[]` through a backend-approved upload and storage design. No upload contract, provider, object reference, signed URL, storage bucket, or durable backend photo model is defined by this prototype.

### SellerAssessment

```ts
interface SellerAssessment {
  definitionId: string;
  version: number;
  source: "seller_reported";
  answers: AssessmentAnswer[];
  reviewedAt?: string;
}

interface AssessmentAnswer {
  questionId: string;
  value:
    | { kind: "choice"; optionId: string }
    | { kind: "multi"; optionIds: string[] }
    | { kind: "number"; value: number }
    | { kind: "unknown" }
    | { kind: "skipped" };
  answeredAt: string;
}
```

The active assessment definition is mock frontend data. It has stable definition/version, section, question and option identities; Thai labels are display copy. Questions declare their required state, supported input type, category/feature applicability and conditional visibility rules. The current types support single choice, yes/no/unknown, numeric and multi-select answers only where needed by this assessment; they do not prescribe a generic form platform or backend schema.

For catalog Apple iPhones, `seller_reported_iphone_v1` contains seven sections: device basics, physical condition, functionality, battery, repair/parts history, account/security and organization management. The fixture gates Face ID, Touch ID and wireless-charging questions by declared features; it also omits functionality questions when the seller reports that the device does not power on. Current iPhone fixtures declare Face ID and wireless charging, so Touch ID is not asked. Repair detail questions appear only after an applicable reported repair; Battery Health is optional, accepts an integer from 0–100, and permits an unknown answer or no value. Every other catalog device uses the non-iPhone `seller_reported_basic_v1` fallback, which contains only power, exterior severity and normal-function questions.

The source is explicitly `seller_reported`. None of these values is a verified inspection, and no browser check verifies hardware, ownership/security, MDM, supervision, repair history or part provenance. A future physical inspection may use a separate verified representation and may verify or override a seller report; that record and its persistence are not defined here.

Valid answers save locally as they change; invalid numeric drafts stay local to the input and preserve the previous saved answer. Clearing the optional input deliberately removes its answer. No-longer-applicable answers are pruned according to the current definition and selected device. A reviewed assessment requires all current required answers and `reviewedAt`; this is a seller review confirmation, not a verification timestamp. An unchanged effective answer set preserves legitimate later status; answer ordering, multi-select ordering, object-key ordering and timestamps do not constitute an answer change. A changed effective assessment clears the saved expected price and obsolete estimated value and returns progress to the assessment stage.

### Legacy ConditionQuestion and ConditionAnswer

```ts
interface ConditionQuestion {
  id: string;
  category: Device["category"];
  prompt: string;
  title?: string;
  topic?: "exterior" | "display" | "functional" | "battery" | "device_specific";
  description?: string;
  answerType?: "single-choice";
  required?: boolean;
  applicableCategories?: Device["category"][];
  analyticsId?: string;
  weight: number;
  options: Array<{ label: string; value: string; normalizedScore: number }>;
}

interface ConditionAnswer {
  questionId: string;
  questionText: string;
  answer: string;
  normalizedScore: number;
  weight: number;
  answeredAt: string;
}
```

These are the v1 questionnaire snapshots, retained solely so existing local sessions remain readable and recoverable. They are not converted automatically to a v2 `SellerAssessment`, never score a v2 seller assessment, and are not used to satisfy its prerequisite. A legacy session is directed to explicitly answer and review the current assessment; its archived `conditionAnswers` remain in the browser-local aggregate.

`answer` stores the Thai option label, not the stable option `value`. Question text, score and weight are copied into the answer, and `answeredAt` is browser-generated. These legacy snapshots must not be mistaken for authoritative server scoring.

### ExpectedPrice

```ts
interface ExpectedPrice {
  amount: number;
  currency: "THB";
  enteredBy: "seller";
  source: "manual_entry";
  createdAt: string;
}
```

The entry screen requires `Number.isSafeInteger(amount)` and `amount > 0`: integer baht from 1 through 9007199254740991. This is a numeric representation constraint, not a business maximum. Commas are display formatting; decimal/satang input is unsupported. Oversized inputs are rejected with a range error, not rounded into a saved amount. Valid input is saved on Continue and the in-app Back action. This frontend check is not server validation.

### Active preliminary valuation range

```ts
interface MockValuationResult {
  minPrice: number;
  maxPrice: number;
  currency: "THB";
}
```

Result and Seller Contact request this shape through `getMockValuationResult`; Request Submitted displays its saved snapshot. It returns the same 24500–27000 fixture regardless of session inputs, including seller-assessment answers. Before submission the range is component state; submission copies it into the local mock receipt, not a production valuation record.

`EstimatedPrice` remains a separate legacy demo domain type containing `amount`, `currency`, `confidence`, `rangeMin`, `rangeMax`, `formulaVersion`, `breakdown` (base value, condition adjustment, market adjustment), and `generatedAt`. `estimateValue()` rejects a session containing a v2 assessment. The active flow does not populate `session.estimatedPrice`; neither this type nor the demo formula defines approved production pricing.

### Valuation request, contact and consent

```ts
interface SellerContact {
  fullName: string;
  phone: string;
  lineIdProvided?: string; // unverified seller-entered text
  consentToContact: boolean;
}

interface RequestContext {
  device: Device;
  assessment: SellerAssessment;
  expectedPrice: ExpectedPrice;
  preliminaryValuation: MockValuationResult;
}

interface ValuationRequestInput {
  sessionId: string;
  context: RequestContext;
  contact: SellerContact;
  source: "atlast_web";
}

interface MockRequestReceipt {
  id: string; // mock-request-{UUID}
  reference: string; // MOCK-... display reference
  sessionId: string;
  state: "submitted";
  submittedAt: string;
  lineConnection: "prototype_pending";
  context: RequestContext;
}
```

The form collects a trimmed nonempty name and phone, optional unverified LINE ID text, and required contact consent. LINE ID is trimmed at its edges; empty input is omitted and no character-pattern rule is imposed. It is not a platform `lineUserId`, proof of following an OA, or permission/ability to message an account. Phone normalization removes whitespace/hyphens; validation requires `^0\d{9}$`. This is format validation, not verification of phone ownership. Contact consent is required and initially unchecked; it is not marketing consent.

`ValuationRequestInput` is transient service input. The mock request adapter returns a UUID-style mock ID, `MOCK-...` reference, browser timestamp and `prototype_pending` LINE state. No server persistence occurs. The session persists only `MockRequestReceipt`, which contains request context but no name, phone, LINE ID or consent evidence. Contact fields and consent are component state and reset on remount. No consent wording/version or authoritative consent timestamp is recorded today.

The legacy `Lead` and `LeadService` types remain for compatibility but are not used by this flow. Legacy statuses `lead_collected` and `handoff_ready` do not count as a submitted request. If a current assessment and expected price are available, a legacy session is directed to submit contact again; otherwise it follows the existing earlier-step recovery.

### Actual lifecycle and invalidation

The normal path is:

`device_selected → condition_completed → expected_price_entered → request_submitted`

- `draft` and `estimated` are declared but not assigned by the current normal flow. Result display does not advance to `estimated`.
- Valid assessment answers save while the seller responds; group Continue confirms changed answer IDs for analytics while status remains `device_selected`. Review confirmation creates `reviewedAt` and advances to `condition_completed`.
- Legacy Condition answers remain present only for recovery. A v2 assessment is complete only when its current definition/version, all applicable required answers, seller source and Review confirmation are present.
- Before request submission, identical effective seller-assessment answers preserve later status. Changed answers clear expected price and legacy estimated value, and return to `device_selected`.
- An unchanged Expected Price preserves later progress. A changed amount sets `expected_price_entered`.
- `request_submitted` means the mock request adapter returned a receipt and that receipt is stored locally. It is not durable server submission, confirmed contact or a LINE connection.
- A stored request receipt locks earlier valuation changes in this browser session. Earlier routes link to the receipt; this MVP provides no revision or restart UI. A fresh browser session begins another prototype trial.
- Legacy `lead_collected` and `handoff_ready` are retained only for compatibility and never satisfy the request-submission prerequisite.
- Before request submission, status ordering permits revisiting earlier completed screens. Route prerequisite checks provide recovery actions. Lowering status is not equivalent to deleting every previously stored field.

### Future placeholder Handoff type

The domain declares `Handoff` with `id`, `sessionId`, `destination: "line_official_account"`, `destinationUrl`, `payload: Record<string, unknown>` and `createdAt`. The current flow does not create this record or use a Handoff service. It has no actual LINE destination URL, operational payload or delivery acknowledgement.

## Future backend persistence requirements

The Backend Developer should implement persistence/API behind the frontend boundaries without treating local browser records as authoritative.

- Backend/API must own persisted session identity, authoritative timestamps, durable request/contact and consent records, and server-confirmed lifecycle milestones.
- Device identity needs stable canonical category, brand, model and configuration/spec identifiers, with catalog/version identity where appropriate. Concepts such as `categoryId`, `brandId` and `modelId` are requirements to resolve, not invented IDs or a schema.
- Durable seller-reported answers need stable assessment definition/version, question and option identity plus structured value representation. Thai display labels must not be canonical keys. Any future verified-inspection record must remain distinct from the seller report.
- Server validation must validate catalog configuration, required answers, accepted monetary representation and contact input; client scores/status flags are not authoritative evidence.
- Durable consent should support consent state, wording/version and an authoritative timestamp. Retention and legal-policy details are not specified here.
- Request/session association, PII handling, retry/idempotency semantics and edit-driven invalidation need an agreed persisted contract.

Anonymous lifetime, resume duration, authentication, final database technology/schema, production valuation methodology/confidence/provenance/expiry and LINE identifiers remain unresolved. No SQL or Supabase schema is prescribed.
