# Atlas Product Overview

## Current implemented Frontend MVP

Atlas is a Thailand-first seller valuation journey. Amounts are in THB. The current implementation is not an operational pawn or secured-loan product.

The seller journey is:

Landing → Device Selection → Seller Device Assessment → Preliminary Valuation → Expected Selling Price → Transaction Intent → Seller Contact → Request Submitted → Connect LINE.

- Device selection progresses through category, brand, model and structured specifications using a research-backed mock catalog. Its phone coverage is curated across Apple, Samsung, Google, Xiaomi, OPPO, vivo, realme, OnePlus, HONOR, Huawei and Sony, with first-release years from 2020–2026 and newest models listed first. Storage choices are model-specific; colors appear only where the maintained fixture has reliable source coverage.
- After required specs, sellers may optionally select up to five JPEG, PNG, or WebP photos, each no larger than 10MB. The browser displays local previews only. Atlas does not upload, analyze, verify, retain, send to Astly or use these photos in the valuation, and they can disappear after refresh or route remounting.
- The Seller Device Assessment is structured and progressive: one manageable question group is shown at a time, with assessment sub-progress inside the main สภาพ stage. Valid answers save locally as they change; Continue confirms the group and advances. Answers use stable question and option identities, while Thai labels remain display copy. Saved answers can be reviewed by section and edited before continuing.
- The current detailed mock covers the Apple iPhones in the catalog. It covers device basics, physical condition, functionality, battery, repair/parts history, account/security and organization management. Repair follow-up questions and feature questions appear only when applicable. Other brands and categories receive a shorter seller-reported fallback rather than iPhone-specific questions. It covers power, severe or liquid damage, screen glass, body damage, display, touch (phones and tablets), cameras, buttons/ports/charging and battery — the items on Astly's seller condition checklist. Function questions are skipped when the seller reports that the device does not power on.
- These answers are seller-reported preliminary information. Atlas does not inspect or technically verify condition, ownership, Find My, Activation Lock, lost status, MDM, supervision, configuration profiles, repair provenance or battery details in this MVP. A future physical inspection may verify or override the report before any final price is confirmed.
- Preliminary Valuation follows the reviewed assessment and requests a real estimate from Astly (www.astly.co) through Atlas's server. While Astly searches Thai used-market listings (normally 30–90 seconds), the screen shows progress; the seller may leave and return, and polling resumes. The result is a single THB figure with its basis: the market reference price, the loan-to-value amount, the condition percentage, Astly's checklist deductions, and Astly's own note on how many listings it used. Astly's `confidence` value is not shown, because the generic phone path always reports its fixed default. It uses the device description and seller-reported condition only, not the seller's expected price, optional photos or colour.
- Astly limits demo estimates per visitor (by default 3 per 10 minutes and 10 per day) and overall. When Astly is unconfigured, rate-limited, unavailable or cannot price the item, Result shows a Thai error with an edit or retry action; it never falls back to a mock price.
- Expected Selling Price follows the preliminary valuation. It is the seller's independently requested amount, not an offer or approved loan amount. Entry accepts positive safe integer baht without decimal/satang support, and changing it preserves the preliminary valuation.
- Transaction Intent is required after Expected Selling Price and stores one stable value: `outright_sale` for ขายขาด or `sell_and_repurchase` for ขายฝาก. Choosing ขายฝาก shows a plain-language explanation (receive money now; buy the device back within the agreed period by paying the outstanding amount plus interest and fees; extend by paying interest, fees and part of the principal; otherwise the device passes to the buyer), and Seller Contact shows indicative interest and fees. The request records intent only; duration, redemption amount, eligibility and final contract terms are confirmed later.
- Valuation wording is preliminary and non-binding; the UI says a final price would require actual inspection. The MVP does not implement inspection or final-price confirmation.
- Seller Contact collects a name, phone, optional unverified LINE ID text and a required contact-consent checkbox. A successful mock submission returns a non-PII request receipt. Contact fields and consent evidence are sent only to the in-memory mock adapter and are not retained in browser session storage or on a server.
- Request Submitted shows the mock receipt and valuation context. Connect LINE is a prototype CTA: it can record the local UI interaction but does not redirect, send data to LINE or confirm delivery.

## Current boundaries

The MVP uses frontend-local `sessionStorage` for valuation progress and a non-PII mock request receipt, mock catalog/question data, Astly's demo estimate API for the preliminary valuation (reached only through Atlas's server routes), an in-memory mock request submission and a logging analytics adapter. It has no database, Supabase, authentication, real LINE integration or operational Astly handoff.

The current catalog contains phone and laptop fixtures; category labels do not imply full catalog coverage. The 2020–2026 phone set is a researched sample, not a complete Thailand inventory. Some models use official regional or global sources where no reliable Thailand archive was available, so availability and configurations can vary. Before request submission, same-device/configuration continuation preserves progress. Changing the selected configuration restarts dependent state. A material assessment edit clears the preliminary valuation (and any estimate still in progress), expected price and transaction intent. Changing expected price preserves the valuation but clears transaction intent; changing intent preserves all upstream valuation state. Missing prerequisites offer recovery actions; earlier screens remain editable until a request is submitted.

Atlas has no pricing algorithm of its own; the preliminary figure is Astly's estimate. Astly derives it for lending: market reference price × a loan-to-value ratio (currently 60%) × condition, snapped to 500 THB. Whether that loan-oriented figure is the right number to show in a seller valuation journey, and how it relates to a sale price, remains an unresolved product decision. The mapping from Atlas's assessment to Astly's checklist is also an Atlas choice; several iPhone answers (scratches, overall usability, repairs, account/security, organization management) are collected but do not affect the estimate. The older formula-based `estimateValue()` method and the fixed `getMockValuationResult()` range are unused demo logic, not the active UI result path and not a pricing specification for backend development. After request submission, the current valuation is intentionally locked for this browser session; a fresh browser session is required for another prototype trial.

## Future product direction

Selling, pawn and secured-transaction concepts remain business hypotheses for future phases. They must not be represented as operational capabilities of this seller MVP.

Future continuation may follow Atlas → LINE OA → operational/Astly integration. Only the preliminary-valuation call to Astly exists today; the LINE and operational integrations require separate product and API decisions. Investor matching, contracts, payment, KYC, renewal interest, redemption, logistics, warehousing and staff/inspection systems are outside the current MVP.

A future request may reference `devicePhotos[]` after an approved upload and storage design exists. The current prototype does not define an upload API, storage vendor, durable photo reference, or backend retention behavior.

## Development principles

- Preserve the Thai-first, mobile-first seller experience.
- Keep future persistence/API implementations behind explicit service and adapter boundaries.
- Clearly distinguish frontend progress from server-confirmed business milestones.
- Do not infer production pricing or integration behavior from mock code.

See DATA_MODEL.md for current state and future ownership, and API_CONTRACT.md for backend handoff decisions. Anonymous session lifetime, resume duration, authentication, Atlas-side treatment of Astly valuations (persistence, provenance, expiry and seller-facing positioning) and LINE/operational integration details remain unresolved.
