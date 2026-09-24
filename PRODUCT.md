# Atlas Product Overview

## Current implemented Frontend MVP

Atlas is a Thailand-first seller valuation journey. Amounts are in THB. The current implementation is not an operational pawn or secured-loan product.

The seller journey is:

Landing → Device Selection → Seller Device Assessment → Preliminary Valuation → Expected Selling Price → Transaction Intent → Seller Contact → Request Submitted → Connect LINE.

- Device selection progresses through category, brand, model and structured specifications using a research-backed mock catalog. Its phone coverage is curated across Apple, Samsung, Google, Xiaomi, OPPO, vivo, realme, OnePlus, HONOR, Huawei and Sony, with first-release years from 2020–2026 and newest models listed first. Storage choices are model-specific; colors appear only where the maintained fixture has reliable source coverage.
- After required specs, sellers may optionally select up to five JPEG, PNG, or WebP photos, each no larger than 10MB. The browser displays local previews only. Atlas does not upload, analyze, verify, retain, or use these photos in the mock valuation, and they can disappear after refresh or route remounting.
- The Seller Device Assessment is structured and progressive: one manageable question group is shown at a time, with assessment sub-progress inside the main สภาพ stage. Valid answers save locally as they change; Continue confirms the group and advances. Answers use stable question and option identities, while Thai labels remain display copy. Saved answers can be reviewed by section and edited before continuing.
- The current detailed mock covers the Apple iPhones in the catalog. It covers device basics, physical condition, functionality, battery, repair/parts history, account/security and organization management. Repair follow-up questions and feature questions appear only when applicable. Other brands and categories receive a minimal seller-reported fallback rather than iPhone-specific questions.
- These answers are seller-reported preliminary information. Atlas does not inspect or technically verify condition, ownership, Find My, Activation Lock, lost status, MDM, supervision, configuration profiles, repair provenance or battery details in this MVP. A future physical inspection may verify or override the report before any final price is confirmed.
- Preliminary Valuation appears immediately after the reviewed assessment and displays a fixed mock range of ฿24,500–฿27,000 through `getMockValuationResult`. This fixture does not require or use the seller's expected price, optional photos, or a production pricing formula.
- Expected Selling Price follows the preliminary range. It is the seller's independently requested amount, not an offer or approved loan amount. Entry accepts positive safe integer baht without decimal/satang support, and changing it preserves the preliminary range.
- Transaction Intent is required after Expected Selling Price and stores one stable value: `outright_sale` for ขายขาด or `sell_and_repurchase` for ขายฝาก. The latter records intent only; this MVP defines no duration, fees, interest, redemption amount, eligibility or contract terms.
- Valuation wording is preliminary and non-binding; the UI says a final price would require actual inspection. The MVP does not implement inspection or final-price confirmation.
- Seller Contact collects a name, phone, optional unverified LINE ID text and a required contact-consent checkbox. A successful mock submission returns a non-PII request receipt. Contact fields and consent evidence are sent only to the in-memory mock adapter and are not retained in browser session storage or on a server.
- Request Submitted shows the mock receipt and valuation context. Connect LINE is a prototype CTA: it can record the local UI interaction but does not redirect, send data to LINE or confirm delivery.

## Current boundaries

The MVP uses frontend-local `sessionStorage` for valuation progress and a non-PII mock request receipt, mock catalog/question data, an in-memory mock request submission and a logging analytics adapter. It has no production backend/database, Supabase, authentication, real LINE integration or Astly integration.

The current catalog contains phone and laptop fixtures; category labels do not imply full catalog coverage. The 2020–2026 phone set is a researched sample, not a complete Thailand inventory. Some models use official regional or global sources where no reliable Thailand archive was available, so availability and configurations can vary. Before request submission, same-device/configuration continuation preserves progress. Changing the selected configuration restarts dependent state. A material assessment edit clears the preliminary range, expected price and transaction intent. Changing expected price preserves the range but clears transaction intent; changing intent preserves all upstream valuation state. Missing prerequisites offer recovery actions; earlier screens remain editable until a request is submitted.

There is no approved production valuation algorithm. The older formula-based `estimateValue()` method is unused demo logic, not the active UI result path and not a pricing specification for backend development. After request submission, the current valuation is intentionally locked for this browser session; a fresh browser session is required for another prototype trial.

## Future product direction

Selling, pawn and secured-transaction concepts remain business hypotheses for future phases. They must not be represented as operational capabilities of this seller MVP.

Future continuation may follow Atlas → LINE OA → operational/Astly integration. These integrations require separate product and API decisions. Investor matching, contracts, payment, KYC, renewal interest, redemption, logistics, warehousing and staff/inspection systems are outside the current MVP.

A future request may reference `devicePhotos[]` after an approved upload and storage design exists. The current prototype does not define an upload API, storage vendor, durable photo reference, or backend retention behavior.

## Development principles

- Preserve the Thai-first, mobile-first seller experience.
- Keep future persistence/API implementations behind explicit service and adapter boundaries.
- Clearly distinguish frontend progress from server-confirmed business milestones.
- Do not infer production pricing or integration behavior from mock code.

See DATA_MODEL.md for current state and future ownership, and API_CONTRACT.md for backend handoff decisions. Anonymous session lifetime, resume duration, authentication, production valuation methodology and integration details remain unresolved.
