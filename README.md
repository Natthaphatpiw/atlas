# Atlas

Atlas is a Thai-first, responsive seller valuation and lead-validation Frontend MVP. It collects device details, a seller-reported device assessment, expected selling price and contact consent. It is not an operational pawn/loan product.

## Current implementation

- Next.js 16.3.5 App Router, React 19, TypeScript and Tailwind CSS 4.
- Progressive device selection, a saved structured Seller Device Assessment, safe-integer THB price entry, preliminary results, Lead Capture and a prepared continuation screen.
- The mock iPhone catalog covers the 13–17 generations with model-specific storage and colors. It is frontend UX test data, not authoritative production inventory. Samsung and MacBook fixtures remain available.
- Valuation progress lives in browser `sessionStorage`, not a backend.
- Result, Lead and Handoff share a fixed mock ฿24,500–฿27,000 range. The unused demo formula is not production pricing.
- Lead submission returns a mock object without durable storage. LINE only shows an availability placeholder.
- No backend/database, Supabase, authentication, real LINE, Astly or production valuation engine is implemented.

## Seller routes

| Route | Purpose |
| --- | --- |
| `/` | Landing |
| `/valuation` | Redirects to `/valuation/device`; no separate start screen |
| `/valuation/device` | Category, brand, model and specs |
| `/valuation/condition` | Seller-reported Device Assessment and review |
| `/valuation/expected-price` | Expected selling price in integer THB |
| `/valuation/result` | Preliminary mock range |
| `/valuation/lead` | Name, phone and required contact consent |
| `/valuation/handoff` | Prepared LINE continuation with intentional placeholder |

`/design-preview/a`, `/design-preview/b` and `/design-preview/c` are development/design artifacts, not steps in the seller flow.

## Architecture

- `app/`: routes and page UI.
- `components/`: shared shell, modal and design-preview components.
- `domain/`: TypeScript domain, assessment and analytics types.
- `services/`: valuation, Lead and analytics interfaces.
- `adapters/mock/`: fixture catalog/assessment definitions, fixed range, mock Lead and console analytics.
- `lib/valuation-session.ts`: browser-local `{ session, device }`, progress updates and device identity comparison.

Pages currently instantiate mock adapters; Device reads mock catalog data directly. Future persistence/API should sit behind these boundaries. Same device ID/spec configuration preserves session progress; a changed configuration restarts dependent state. The assessment is seller-reported preliminary information, never an Atlas or Apple verified inspection. Backend authority and unresolved decisions are described in API_CONTRACT.md and DATA_MODEL.md.

## Run and validate

```bash
npm install
npm run dev
```

Open http://localhost:3000.

```bash
npm run lint
npx tsc --noEmit
node --test tests/assessment.test.cjs
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
