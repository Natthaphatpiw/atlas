# Atlas Data Model

## Current frontend model

The source definitions are in `domain/types.ts`, `domain/assessment.ts`, `services/valuation-service.ts` and `lib/valuation-session.ts`. These are frontend contracts, not database schemas.

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
    "expected_price_entered" | "estimated" | "lead_collected" | "handoff_ready";
  deviceId?: string;
  conditionAnswers: ConditionAnswer[]; // legacy v1 recovery snapshots
  assessment?: SellerAssessment;
  expectedPrice?: ExpectedPrice;
  estimatedPrice?: EstimatedPrice;
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

The mock catalog covers representative iPhone 13–17 models with model-specific storage and color options, plus the existing fixed Galaxy S24 Ultra and MacBook Air configurations. Mock-only `MockCatalogDevice.specOptions` supplies selectable values per spec; absent option lists fall back to the fixture’s single spec value. Confirmation stores only the selected `Device` snapshot, without option lists. Model changes clear dependent specs; changing one spec preserves the other selections. Existing iPhone 15 Pro IDs and the original 256GB / Natural Titanium / 5G configuration remain compatible with stored sessions. This is frontend UX/development data, not authoritative production inventory. Brand/model labels, spec values, `marketHints` and fixture timestamps are not a canonical backend catalog design.

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

For Apple iPhones, `seller_reported_iphone_v1` contains seven sections: device basics, physical condition, functionality, battery, repair/parts history, account/security and organization management. The fixture gates Face ID, Touch ID and wireless-charging questions by declared features; it also omits functionality questions when the seller reports that the device does not power on. Current iPhone fixtures declare Face ID and wireless charging, so Touch ID is not asked. Repair detail questions appear only after an applicable reported repair; Battery Health is optional, accepts an integer from 0–100, and permits an unknown answer or no value. The non-iPhone `seller_reported_basic_v1` fallback contains only power, exterior severity and normal-function questions.

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

Result, Lead and Handoff request this shape through `getMockValuationResult`. It returns the same 24500–27000 fixture regardless of session inputs, including seller-assessment answers. The result is component state, not a persisted valuation record.

`EstimatedPrice` remains a separate legacy demo domain type containing `amount`, `currency`, `confidence`, `rangeMin`, `rangeMax`, `formulaVersion`, `breakdown` (base value, condition adjustment, market adjustment), and `generatedAt`. `estimateValue()` rejects a session containing a v2 assessment. The active flow does not populate `session.estimatedPrice`; neither this type nor the demo formula defines approved production pricing.

### Lead and consent

```ts
interface Lead {
  id: string;
  sessionId: string;
  fullName: string;
  phone: string;
  email?: string;
  consentToContact: boolean;
  source: "atlast_web";
  createdAt: string;
}
```

The form collects a trimmed nonempty name and phone. Phone normalization removes whitespace/hyphens; validation requires `^0\d{9}$`. This is format validation, not verification of phone ownership. Email is optional in the type but absent from the UI. Contact consent is required and initially unchecked; it is not marketing consent.

The mock adapter echoes submitted data with ID `mock-lead-${sessionId}` and a browser timestamp. No server persistence occurs. The page does not retain the returned Lead or its ID in the session. Contact fields and consent are component state and reset on remount. The session stores only the progress milestone, not contact PII. No consent wording/version or authoritative consent timestamp is recorded today.

### Actual lifecycle and invalidation

The normal path is:

`device_selected → condition_completed → expected_price_entered → lead_collected → handoff_ready`

- `draft` and `estimated` are declared but not assigned by the current normal flow. Result display does not advance to `estimated`.
- Valid assessment answers save while the seller responds; group Continue confirms changed answer IDs for analytics while status remains `device_selected`. Review confirmation creates `reviewedAt` and advances to `condition_completed`.
- Legacy Condition answers remain present only for recovery. A v2 assessment is complete only when its current definition/version, all applicable required answers, seller source and Review confirmation are present.
- Identical effective seller-assessment answers preserve later status. Changed answers clear expected price and legacy estimated value, and return to `device_selected`.
- An unchanged Expected Price preserves later progress. A changed amount sets `expected_price_entered`.
- `lead_collected` means mock submission succeeded and local progress advanced, not that a durable lead exists.
- `handoff_ready` means the continuation screen prepared its mock context. It does not mean LINE is connected, clicked or delivered.
- Status ordering permits earlier completed screens after advanced stages. Route prerequisite checks provide recovery actions. Lowering status is not equivalent to deleting every previously stored field.

### Future placeholder Handoff type

The domain declares `Handoff` with `id`, `sessionId`, `destination: "line_official_account"`, `destinationUrl`, `payload: Record<string, unknown>` and `createdAt`. The current flow does not create this record or use a Handoff service. It has no actual LINE destination URL, operational payload or delivery acknowledgement.

## Future backend persistence requirements

The Backend Developer should implement persistence/API behind the frontend boundaries without treating local browser records as authoritative.

- Backend/API must own persisted session identity, authoritative timestamps, durable Lead and consent records, and server-confirmed lifecycle milestones.
- Device identity needs stable canonical category, brand, model and configuration/spec identifiers, with catalog/version identity where appropriate. Concepts such as `categoryId`, `brandId` and `modelId` are requirements to resolve, not invented IDs or a schema.
- Durable seller-reported answers need stable assessment definition/version, question and option identity plus structured value representation. Thai display labels must not be canonical keys. Any future verified-inspection record must remain distinct from the seller report.
- Server validation must validate catalog configuration, required answers, accepted monetary representation and contact input; client scores/status flags are not authoritative evidence.
- Durable consent should support consent state, wording/version and an authoritative timestamp. Retention and legal-policy details are not specified here.
- Lead/session association, retry semantics and edit-driven invalidation need an agreed persisted contract.

Anonymous lifetime, resume duration, authentication, final database technology/schema, production valuation methodology/confidence/provenance/expiry and LINE identifiers remain unresolved. No SQL or Supabase schema is prescribed.
