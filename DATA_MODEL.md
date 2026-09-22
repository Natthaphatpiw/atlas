# Atlast Data Model

## Current frontend model

The source definitions are in `domain/types.ts`, `services/valuation-service.ts` and `lib/valuation-session.ts`. These are frontend contracts, not database schemas.

### Browser-local aggregate

```ts
interface StoredValuationSession {
  session: ValuationSession;
  device: Device;
}
```

This JSON aggregate is stored under `atlast.valuation.session` in browser `sessionStorage`. It supports refresh and navigation in the browser page session; it is not durable backend storage, a cross-device account or a guaranteed resume service. Browser clearing/closing behavior can remove it. Reads parse JSON and cast types; they do not perform runtime schema validation.

```ts
interface ValuationSession {
  id: string;
  status: "draft" | "device_selected" | "condition_completed" |
    "expected_price_entered" | "estimated" | "lead_collected" | "handoff_ready";
  deviceId?: string;
  conditionAnswers: ConditionAnswer[];
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

The mock catalog contains iPhone 15 Pro, Galaxy S24 Ultra and MacBook Air, each with one supplied configuration. Brand/model labels, spec values, `marketHints` and fixture timestamps are not a canonical backend catalog design.

### ConditionQuestion and ConditionAnswer

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

Current fixtures contain four phone questions and one laptop question. Selecting an option creates a local draft; Continue persists through the session helper. Refresh resumes from saved answers, not unconfirmed drafts. Review allows edits.

`answer` currently stores the Thai option label, not the stable option `value`. Question text, score and weight are copied into the answer, and `answeredAt` is browser-generated. These snapshots must not be mistaken for authoritative server scoring. Durable answer identity/versioning is a future requirement below.

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

Result, Lead and Handoff request this shape through `getMockValuationResult`. It returns the same 24500–27000 fixture regardless of session inputs. The result is component state, not a persisted valuation record.

`EstimatedPrice` remains a separate domain type containing `amount`, `currency`, `confidence`, `rangeMin`, `rangeMax`, `formulaVersion`, `breakdown` (base value, condition adjustment, market adjustment), and `generatedAt`. The unused demo `estimateValue()` returns it. The active flow does not populate `session.estimatedPrice`; neither this type nor the demo formula defines approved production pricing.

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
- Intermediate Condition saves use `device_selected`; final-question Continue and review completion use `condition_completed`.
- Identical saved answers preserve later status; changed answers lower it. Answer comparison includes the stored answer objects, including timestamps. Existing Expected Price is retained when Condition changes.
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
- Durable answers need stable questionnaire/version, question and option identity. Thai display labels must not be canonical keys.
- Server validation must validate catalog configuration, required answers, accepted monetary representation and contact input; client scores/status flags are not authoritative evidence.
- Durable consent should support consent state, wording/version and an authoritative timestamp. Retention and legal-policy details are not specified here.
- Lead/session association, retry semantics and edit-driven invalidation need an agreed persisted contract.

Anonymous lifetime, resume duration, authentication, final database technology/schema, production valuation methodology/confidence/provenance/expiry and LINE identifiers remain unresolved. No SQL or Supabase schema is prescribed.
