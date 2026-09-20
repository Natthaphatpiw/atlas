# Astly Handoff Contract (Future Only)

This document defines a placeholder contract for a possible future Astly integration. It does not represent an implemented feature in the Atlast MVP.

## Status
- Not implemented
- Not required for the MVP
- Not connected to current flow

## Purpose
If Atlast later needs to pass a seller or lead to Astly, the data should be transferred using a clean, explicit boundary and typed payloads.

## Future handoff boundary
```ts
interface AstlyHandoffPayload {
  source: "atlast";
  sessionId: string;
  leadId?: string;
  deviceId?: string;
  estimatedAmount?: number;
  expectedAmount?: number;
  createdAt: string;
}
```

## Future responsibilities
- Atlast sends only validated business data.
- Astly owns downstream operational handling.
- Atlast remains a separate frontend product in this phase.

## Guardrails
- No Astly API calls are made in the current project.
- No Astly integration code is added to the frontend yet.
- No database or backend infrastructure is introduced to support this future integration.
