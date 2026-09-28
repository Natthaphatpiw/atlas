# Atlas

Atlas is a Thai-first, responsive seller valuation Frontend MVP. It collects device details, a seller-reported assessment, shows a preliminary valuation from Astly's estimate service, then collects expected price, transaction intent and contact/consent for one mock valuation-request submission. It is not an operational pawn/loan product.

## Current implementation

- Next.js 16.3.5 App Router, React 19, TypeScript and Tailwind CSS 4.
- Progressive device selection, a saved structured Seller Device Assessment, preliminary results, safe-integer THB price entry, required transaction intent, seller contact, a mock request receipt and a prototype LINE continuation screen.
- Device Selection optionally previews up to five seller-selected JPEG, PNG, or WebP photos (10MB each). They are browser-memory previews only: they are not uploaded, sent to Astly, valued, analyzed, included in analytics/receipts, or retained after refresh or route remounting.
- The research-backed mock catalog contains 81 phones across 11 brands, spanning first-release years 2020–2026, plus the existing MacBook fixture. Model storage comes from manufacturer sources; verified colors remain on the Apple fixtures and the compatible Galaxy S24 Ultra snapshot. It is curated frontend UX test data, not authoritative production or region-wide inventory.
- Valuation progress lives in browser `sessionStorage`. The only server code is two Atlas route handlers that proxy Astly's demo estimate API; they persist nothing.
- Result requests a real preliminary estimate from Astly (www.astly.co) through those routes and shows a single THB figure. Expected Price, Seller Contact and Request Submitted reuse that saved snapshot. Without Astly configuration, Result shows a temporary-unavailable error; there is no mock fallback. The fixed ฿24,500–฿27,000 fixture and the demo formula remain in the mock adapter, are no longer on the Result path and are not production pricing.
- Contact is passed only to the in-memory mock request service. The browser session persists a non-PII mock receipt, never contact fields or consent evidence. LINE is a prototype CTA only.
- No database, Supabase, authentication, real LINE or operational Astly handoff is implemented. The Astly integration covers the preliminary estimate only; Atlas does not own or define the pricing methodology.

## Seller routes

| Route | Purpose |
| --- | --- |
| `/` | Landing |
| `/valuation` | Redirects to `/valuation/device`; no separate start screen |
| `/valuation/device` | Category, brand, model and specs |
| `/valuation/condition` | Seller-reported Device Assessment and review |
| `/valuation/result` | Preliminary Astly estimate (single THB figure), with progress, failure and retry states |
| `/valuation/expected-price` | Expected selling price in integer THB after viewing the preliminary valuation |
| `/valuation/transaction-intent` | Required outright-sale or sell-and-repurchase intent |
| `/valuation/lead` | Seller contact and required consent for a mock request |
| `/valuation/handoff` | Mock request receipt and prototype LINE continuation |

`/design-preview/a`, `/design-preview/b` and `/design-preview/c` are development/design artifacts, not steps in the seller flow.

Server routes used by Result (not seller pages):

| Route | Purpose |
| --- | --- |
| `POST /api/valuation/estimate` | Validates the device and assessment, then starts an Astly estimate job |
| `GET /api/valuation/estimate/[jobId]` | Polls that Astly job; requires the signed `X-Estimate-Ticket` issued when it started |

## Architecture

- `app/`: routes and page UI.
- `app/api/valuation/estimate/`: server route handlers that proxy Astly's demo estimate API.
- `components/`: shared shell, modal and design-preview components.
- `domain/`: TypeScript domain, assessment and analytics types; `domain/astly.ts` holds the Astly estimate contract and the session shapes that store it.
- `services/`: valuation, valuation-request, legacy Lead and analytics interfaces.
- `data/devices/`: brand-scoped research-backed catalog fixtures and source metadata.
- `adapters/mock/`: mock catalog access, assessment definitions, the now-unused fixed range, mock request/legacy Lead and console analytics.
- `adapters/astly/estimate-client.ts`: browser client for Atlas's own estimate routes; it never calls astly.co.
- `lib/estimate-request-body.ts`, `lib/estimate-request.ts`, `lib/astly-estimate-input.ts`: the browser request body, its server-side re-validation, and the mapping onto Astly's request and condition checklist.
- `lib/server/`: server-only Astly client (reads the API key) and the anonymous visitor ID.
- `lib/valuation-format.ts`: shared THB formatting; a single price when the valuation is a point estimate, otherwise a range.
- `lib/valuation-session.ts`: browser-local `{ session, device }`, progress updates, device identity comparison and the pending/saved Astly estimate.
- `lib/device-photos.ts`: browser-only photo selection limits and validation; it has no persistence or upload behavior.

Pages instantiate mock adapters for the catalog, assessment, request and analytics; Device loads catalog records through `ValuationService`. For the valuation itself, Result uses the Astly estimate client instead of a mock adapter. The mock adapter reads the frontend data layer, and a future backend catalog can replace that adapter without changing the selection page contract. Same device ID/spec configuration preserves session progress; a changed configuration restarts dependent state. Once a mock request receipt exists, earlier valuation screens are read-only and link to the receipt; starting another prototype trial requires a fresh browser session. The assessment is seller-reported preliminary information, never an Atlas or Apple verified inspection. Backend authority and unresolved decisions are described in API_CONTRACT.md and DATA_MODEL.md.

## Astly estimate integration

Browser → Atlas `POST /api/valuation/estimate` / `GET /api/valuation/estimate/[jobId]` → Astly `POST /api/demo/estimate` / `GET /api/demo/estimate/{jobId}`. The browser never calls astly.co and never sees the key.

- The server re-validates the device against the catalog and the assessment against its current definition before calling Astly. It sends item type, brand, model and capacity (MacBook specs as free text), plus Astly's eight-item seller condition checklist derived from the seller-reported answers. It sends no colour, photos, contact data, expected price, transaction intent or session ID. API_CONTRACT.md documents the mapping.
- Astly returns a point `estimatedPrice` (its market reference price × loan-to-value × condition multiplier, snapped to a 500 THB step) with `marketPrice`, `pawnPrice`, `condition`, `confidence`, `productName` and Thai calculation strings. Atlas saves it on the session with `minPrice = maxPrice = estimatedPrice` and `source: "astly"`.
- An estimate normally takes 30–90 seconds. A started job is saved in the session, so a reload resumes polling rather than starting another estimate. Any assessment or device change invalidates both the job and the saved valuation.
- Astly enforces per-visitor limits (defaults: 3 per 10 minutes and 10 per day), global caps and a demo-only spend ceiling. Resubmitting an identical request returns the same job and costs no quota. The visitor ID is an HMAC, keyed by `ATLAS_VISITOR_SECRET`, of the client network: an IPv4 address, or an IPv6 /64 (`lib/server/visitor.ts`). Astly never receives the IP. Starting an estimate returns a signed ticket, and polling uses it, so a network change mid-estimate (Wi-Fi to cellular) keeps the job. Locally, every request comes from one network, so the per-visitor limit is reached quickly.

Environment (see `.env.example`; server-only, never `NEXT_PUBLIC_`):

| Variable | Required | Purpose |
| --- | --- | --- |
| `ASTLY_DEMO_API_KEY` | Yes | Server-to-server key issued by Astly (one of Astly's `DEMO_ESTIMATE_API_KEYS`). Without it, Result shows a temporary-unavailable error. |
| `ASTLY_API_BASE_URL` | No | Defaults to `https://www.astly.co`. |
| `ATLAS_VISITOR_SECRET` | Yes | Atlas-only HMAC secret (≥ 32 chars, different from `ASTLY_DEMO_API_KEY`, never given to Astly) for visitor IDs and estimate tickets. Estimates are disabled without it. Rotating it invalidates in-flight tickets. |

```bash
cp .env.example .env.local   # then set ASTLY_DEMO_API_KEY
npm run dev
```

`.env*` files other than `.env.example` are git-ignored. A deployment needs the same variables in its host's environment settings. Behind a proxy other than Vercel, confirm that `x-forwarded-for` cannot be set by the client, or visitor limits can be bypassed or shared.

## Run and validate

```bash
npm install
npm run dev
```

Open http://localhost:3000. Result needs the Astly environment above; the rest of the flow does not.

```bash
npm run lint
npx tsc --noEmit
node --test tests/*.test.cjs
git diff --check
npm run build
npm run start
```

`tests/astly.test.cjs` stubs `fetch`; the test suite never calls Astly.

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
- API_CONTRACT.md: service boundaries, the Astly estimate boundary, analytics semantics, provisional APIs and Backend Developer decisions.
- ASTLY_HANDOFF.md: the current Astly valuation integration and the future LINE/operational integration boundary.
- AGENTS.md: development constraints; consult the installed Next.js guides before source changes.

Backend work must not derive production pricing from mock code or choose unresolved product/integration decisions implicitly. Database technology/schema and the final API design remain undecided.
