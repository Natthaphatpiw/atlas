# Atlast Data Model

## Core domain types

### Device
Represents the seller's device and its identifying metadata.

```ts
interface Device {
  id: string;
  category: "phone" | "tablet" | "laptop" | "watch" | "audio" | "other";
  brand: string;
  model: string;
  variant?: string;
  specs: Record<string, string | undefined>;
  marketHints?: string[];
  createdAt: string;
}
```

### ValuationSession
Tracks the current valuation flow and collection of seller inputs.

```ts
interface ValuationSession {
  id: string;
  status: "draft" | "device_selected" | "condition_completed" | "expected_price_entered" | "estimated" | "lead_collected" | "handoff_ready";
  deviceId?: string;
  conditionAnswers: ConditionAnswer[];
  expectedPrice?: ExpectedPrice;
  estimatedPrice?: EstimatedPrice;
  createdAt: string;
  updatedAt: string;
}
```

### ConditionAnswer
Represents one answer to a device-condition assessment question.

```ts
interface ConditionAnswer {
  questionId: string;
  questionText: string;
  answer: string;
  normalizedScore: number;
  weight: number;
  answeredAt: string;
}
```

### ExpectedPrice
Represents the amount the seller expects to receive.

```ts
interface ExpectedPrice {
  amount: number;
  currency: "THB";
  enteredBy: "seller";
  source: "manual_entry";
  createdAt: string;
}
```

### EstimatedPrice
Represents the estimate produced by the valuation service.

```ts
interface EstimatedPrice {
  amount: number;
  currency: "THB";
  confidence: number;
  rangeMin: number;
  rangeMax: number;
  formulaVersion: string;
  breakdown: {
    baseValue: number;
    conditionAdjustment: number;
    marketAdjustment: number;
  };
  generatedAt: string;
}
```

### Lead
Represents the minimum seller information captured when they proceed.

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

### Handoff
Represents the prepared handoff to the Atlast LINE OA boundary.

```ts
interface Handoff {
  id: string;
  sessionId: string;
  destination: "line_official_account";
  destinationUrl: string;
  payload: Record<string, unknown>;
  createdAt: string;
}
```

## Design notes
- THB is used throughout the product and codebase.
- Mock pricing logic is intentionally isolated and must not be described as production business logic.
- The frontend contract is ready for a future backend API implementation.
- Future Astly handoff is out of scope and intentionally not implemented.
