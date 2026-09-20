# Atlast API Contract (Future)

This document defines the expected boundary for future backend integration. It is not an implementation plan for a production backend in this phase.

## Principles
- Frontend depends only on service interfaces.
- Real API implementations will replace mock adapters later.
- No database or Supabase is introduced in this phase.
- All API interactions should use a typed contract and explicit adapters.

## Service interfaces

### ValuationService
```ts
interface ValuationService {
  getDeviceCatalog(): Promise<Device[]>;
  getConditionQuestions(deviceCategory: Device["category"]): Promise<ConditionQuestion[]>;
  estimateValue(session: ValuationSession): Promise<EstimatedPrice>;
}
```

### LeadService
```ts
interface LeadService {
  submitLead(input: Omit<Lead, "id" | "createdAt">): Promise<Lead>;
}
```

### AnalyticsService
```ts
interface AnalyticsService {
  track(event: AnalyticsEvent): void;
}
```

## Future REST-like endpoints

### GET /devices
Returns a catalog of available devices.

### GET /condition-questions?category={deviceCategory}
Returns condition questions for a device category.

### POST /valuation/estimate
Takes a valuation session and returns an estimate.

### POST /leads
Stores a lead and returns the created lead record.

### POST /handoff/line
Prepares a handoff payload for the Atlast LINE OA boundary.

## Response envelope (future)
```json
{
  "data": {},
  "meta": {
    "requestId": "uuid",
    "generatedAt": "2026-09-20T00:00:00.000Z"
  }
}
```

## Error envelope (future)
```json
{
  "error": {
    "code": "validation_error",
    "message": "The request payload is invalid.",
    "details": []
  }
}
```

## Notes
- This contract is for future backend replacement only.
- The current demo implementation is a mock service that intentionally does not represent production pricing logic.
- LINE integration and Astly integration remain outside the MVP and are not currently implemented.
