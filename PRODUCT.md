# Atlast Product Overview

## Current implemented Frontend MVP

Atlast is a Thailand-first seller valuation and lead-validation journey. Amounts are in THB. The current implementation is not an operational pawn or secured-loan product.

The seller journey is:

Landing → Device Selection → Condition → Expected Selling Price → Preliminary Valuation → Lead Capture → prepared LINE continuation screen.

- Device selection progresses through category, brand, model and structured specifications using a small mock catalog.
- Condition questions are category-specific. Selecting an answer is a draft; Continue saves it and advances. Saved answers can be reviewed and edited.
- Expected Selling Price is the seller's requested amount, not an offer or approved loan amount. Entry accepts positive safe integer baht without decimal/satang support. The technical numeric bound is not a business price maximum.
- Preliminary Valuation displays a fixed mock range of ฿24,500–฿27,000 through `getMockValuationResult`. This fixture does not calculate a price from the selected device, condition or expected price. Result, Lead and Handoff share this boundary.
- Valuation wording is preliminary and non-binding; the UI says a final price would require actual inspection. The MVP does not implement inspection or final-price confirmation.
- Lead Capture collects a name, phone and required contact-consent checkbox. Submission is mocked and non-durable: it does not store a lead on a server or arrange a real callback.
- The prepared LINE continuation screen shows the valuation context. Its button displays an intentional message that LINE connection will be available when the real system opens. It does not redirect, send data to LINE or confirm delivery.

## Current boundaries

The MVP uses frontend-local `sessionStorage` for valuation progress, mock catalog/question data, mock lead submission and a logging analytics adapter. It has no production backend/database, Supabase, authentication, real LINE integration or Astly integration.

The current catalog contains phone and laptop fixtures; category labels do not imply full catalog coverage. Same-device/configuration continuation preserves progress. Changing the selected configuration restarts dependent state. Missing prerequisites offer recovery actions; later completion statuses allow revisiting earlier screens.

There is no approved production valuation algorithm. The older formula-based `estimateValue()` method is unused demo logic, not the active UI result path and not a pricing specification for backend development.

## Future product direction

Selling, pawn and secured-transaction concepts remain business hypotheses for future phases. They must not be represented as operational capabilities of this seller MVP.

Future continuation may follow Atlast → LINE OA → operational/Astly integration. These integrations require separate product and API decisions. Investor matching, contracts, payment, KYC, renewal interest, redemption, logistics, warehousing and staff/inspection systems are outside the current MVP.

## Development principles

- Preserve the Thai-first, mobile-first seller experience.
- Keep future persistence/API implementations behind explicit service and adapter boundaries.
- Clearly distinguish frontend progress from server-confirmed business milestones.
- Do not infer production pricing or integration behavior from mock code.

See DATA_MODEL.md for current state and future ownership, and API_CONTRACT.md for backend handoff decisions. Anonymous session lifetime, resume duration, authentication, production valuation methodology and integration details remain unresolved.
