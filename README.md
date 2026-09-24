# Atlas

Atlas is a Thai-first, responsive seller valuation Frontend MVP. It collects device details, a seller-reported assessment, shows a preliminary valuation, then collects expected price, transaction intent and contact/consent for one mock valuation-request submission. It is not an operational pawn/loan product.

## Current implementation

- Next.js 16.3.5 App Router, React 19, TypeScript and Tailwind CSS 4.
- Progressive device selection, a saved structured Seller Device Assessment, preliminary results, safe-integer THB price entry, required transaction intent, seller contact, a mock request receipt and a prototype LINE continuation screen.
- Device Selection optionally previews up to five seller-selected JPEG, PNG, or WebP photos (10MB each). They are browser-memory previews only: they are not uploaded, valued, analyzed, included in analytics/receipts, or retained after refresh or route remounting.
- The research-backed mock catalog contains 81 phones across 11 brands, spanning first-release years 2020–2026, plus the existing MacBook fixture. Model storage comes from manufacturer sources; verified colors remain on the Apple fixtures and the compatible Galaxy S24 Ultra snapshot. It is curated frontend UX test data, not authoritative production or region-wide inventory.
- Valuation progress lives in browser `sessionStorage`, not a backend.
- Result, Seller Contact and Request Submitted share a fixed mock ฿24,500–฿27,000 range. The unused demo formula is not production pricing.
- Contact is passed only to the in-memory mock request service. The browser session persists a non-PII mock receipt, never contact fields or consent evidence. LINE is a prototype CTA only.
- No backend/database, Supabase, authentication, real LINE, Astly or production valuation engine is implemented.

## Seller routes

| Route | Purpose |
| --- | --- |
| `/` | Landing |
| `/valuation` | Redirects to `/valuation/device`; no separate start screen |
| `/valuation/device` | Category, brand, model and specs |
| `/valuation/condition` | Seller-reported Device Assessment and review |
| `/valuation/result` | Preliminary mock range |
| `/valuation/expected-price` | Expected selling price in integer THB after viewing the range |
| `/valuation/transaction-intent` | Required outright-sale or sell-and-repurchase intent |
| `/valuation/lead` | Seller contact and required consent for a mock request |
| `/valuation/handoff` | Mock request receipt and prototype LINE continuation |

`/design-preview/a`, `/design-preview/b` and `/design-preview/c` are development/design artifacts, not steps in the seller flow.

## Architecture

- `app/`: routes and page UI.
- `components/`: shared shell, modal and design-preview components.
- `domain/`: TypeScript domain, assessment and analytics types.
- `services/`: valuation, valuation-request, legacy Lead and analytics interfaces.
- `data/devices/`: brand-scoped research-backed catalog fixtures and source metadata.
- `adapters/mock/`: mock catalog access, assessment definitions, fixed range, mock request/legacy Lead and console analytics.
- `lib/valuation-session.ts`: browser-local `{ session, device }`, progress updates and device identity comparison.
- `lib/device-photos.ts`: browser-only photo selection limits and validation; it has no persistence or upload behavior.

Pages currently instantiate mock adapters; Device loads catalog records through `ValuationService`. The mock adapter reads the frontend data layer, and a future backend catalog can replace that adapter without changing the selection page contract. Same device ID/spec configuration preserves session progress; a changed configuration restarts dependent state. Once a mock request receipt exists, earlier valuation screens are read-only and link to the receipt; starting another prototype trial requires a fresh browser session. The assessment is seller-reported preliminary information, never an Atlas or Apple verified inspection. Backend authority and unresolved decisions are described in API_CONTRACT.md and DATA_MODEL.md.

## Run and validate

```bash
npm install
npm run dev
```

Open http://localhost:3000.

```bash
npm run lint
npx tsc --noEmit
node --test tests/*.test.cjs
git diff --check
npm run build
npm run start
```

An observed environment-specific Turbopack failure reports `binding to a port — Operation not permitted (os error 1)`. It is not a universal application failure. When that environment prevents the default build, the established verification fallback is:

```bash
npm run build -- --webpack
```

Do not change project configuration merely to work around that environment issue. Record materially different failures separately.

## Branch workflow

- Frozen external tester baseline: `qa/mvp-flow-v1` at `5bdfc85`. It retains the previous Atlast naming. Its shared Preview must remain unchanged during continued development; do not commit or push new changes to that branch.
- Continued development: `develop/mvp-v2`, created from the frozen baseline.
- This separation does not imply a production merge. No deployment URL is specified here.
- `lib/valuation-session 2.ts` is a known unrelated untracked duplicate. Do not modify, stage, delete, rename or commit it.

The Atlas rename is product-facing. The package name `atlast`, browser key `atlast.valuation.session`, and contact source `atlast_web` intentionally retain their technical names for compatibility. The earlier `source: "atlast"` candidate in ASTLY_HANDOFF.md is historical and remains unresolved.

## Documentation and backend handoff

- PRODUCT.md: implemented seller MVP versus future business direction.
- DATA_MODEL.md: current local model and future authoritative persistence requirements.
- API_CONTRACT.md: service boundaries, analytics semantics, provisional APIs and Backend Developer decisions.
- ASTLY_HANDOFF.md: future LINE/operational integration boundary.
- AGENTS.md: development constraints; consult the installed Next.js guides before source changes.

Backend work must not derive production pricing from mock code or choose unresolved product/integration decisions implicitly. Database technology/schema and the final API design remain undecided.
