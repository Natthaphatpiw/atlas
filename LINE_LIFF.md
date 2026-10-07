# Atlas LINE LIFF app

Atlas also runs inside LINE as a LIFF app. It serves the same pages as the web flow under `/liff`, with three additions: the user signs in with LINE and must have added the Atlas Official Account; Atlas records how they use the flow; and a submitted request is stored in the database and confirmed to the user in a LINE chat message.

| | |
| --- | --- |
| LIFF URL (share this) | `https://liff.line.me/2011873191-6AQ7I8vq` |
| LIFF endpoint URL (LINE Developers) | `https://atlasorg.vercel.app/liff` |
| LINE Login channel (owns the LIFF app) | `2011873191` |
| Messaging API channel (Atlas OA `@490jvnda`) | `2011873159` |

The web flow at `/` and `/valuation/*` is unchanged: it keeps the local mock request and calls none of the LIFF APIs.

## Flow

1. The user opens the LIFF URL. Inside LINE they are signed in automatically; in another browser LIFF sends them through LINE Login first.
2. The page sends the LIFF ID token to `POST /api/liff/session`. Atlas's server verifies it with LINE (`/oauth2/v2.1/verify`, `client_id` = the LINE Login channel) and returns Atlas's own session token (12 hours, HMAC-signed with `ATLAS_VISITOR_SECRET`). Every later `/api/liff/*` call sends it as `Authorization: Bearer …`. The browser never chooses its LINE user ID. An expired LINE ID token (they last about an hour, and LIFF keeps them between visits outside LINE) triggers one fresh LINE sign-in; an expired Atlas session token is renewed on the first 401.
3. The server checks friendship by asking the Messaging API for the user's profile: LINE returns it only for users who have added (and not blocked) the OA. A user who has not added Atlas sees an add-friend screen. Its button opens LIFF's add-friend dialog where LINE supports it, otherwise the OA's profile page; returning to the app re-checks automatically. When the server cannot tell (no Messaging API token), the app falls back to `liff.getFriendship()`; when neither can tell, it lets the user in.
4. The user goes through the same steps as the web: device → condition → Astly estimate → asking price → ขายขาด (`outright_sale`) or ขายฝาก (`sell_and_repurchase`) → contact form → completion screen.
5. Estimates are metered by Astly per LINE user (`lineVisitorId`), not per network, so users behind one mobile-carrier IP do not share a quota.
6. On submit, `POST /api/liff/requests` re-validates the device, assessment, contact, asking price and sale type, and requires the user to still be a friend of the OA (403 otherwise). It confirms the price (`estimate_verified`) from the **price receipt** that Atlas signed when polling first saw the finished Astly result — bound to that job and that exact device and assessment, valid 24 hours — or else by re-reading the job with its ticket. A verified row also takes its condition score from Astly's result. It then stores the request and pushes a Flex message to the user: product, specs, estimated price (the used-market price the seller was shown, recomputed by the server from the verified result), asking price, sale type, date and time (Bangkok) and reference `ATL-XXXXXXXX`. A price Atlas could not verify is stored (flagged) but never quoted in the message, which says the team will confirm it. The push uses the request id as LINE's retry key: a resubmit after a failed push sends it again, and never twice.
7. The completion screen shows the reference and a **ปิดหน้าต่าง** button that calls `liff.closeWindow()` (in a normal browser it says the tab can be closed).

## LINE Developers setup

1. **Same provider.** The LINE Login channel `2011873191` and the Messaging API channel `2011873159` must be under the same provider. LINE user IDs are per provider; otherwise the friendship check and the push name a different user ID and fail.
2. **LIFF app** (LINE Login channel → LIFF tab → the app `2011873191-6AQ7I8vq`):
   - Endpoint URL: `https://atlasorg.vercel.app/liff`
   - Size: Full
   - Scopes: `openid` (required: the server verifies the ID token) and `profile`
   - Add friend option: **On (Aggressive)**, so LINE offers the Atlas OA during the user's first consent
   - Scan QR: off
3. **Link the OA** (LINE Login channel → Basic settings → Linked LINE Official Account → Atlas `@490jvnda`). Required for the add-friend option, `liff.getFriendship()` and LIFF's add-friend dialog.
4. **Messaging API channel**: issue a long-lived channel access token for `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`. Atlas needs no webhook and does not use the channel secret.

Campaign links: add `src` or `utm_*` parameters to the LIFF URL, for example `https://liff.line.me/2011873191-6AQ7I8vq?src=facebook`. LIFF forwards them to the endpoint, and they are recorded on the `liff_opened` event.

## Environment

In addition to the Astly variables in the README (`ASTLY_DEMO_API_KEY`, `ASTLY_API_BASE_URL`, `ATLAS_VISITOR_SECRET`, all required):

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_LIFF_ID` | Yes | `2011873191-6AQ7I8vq`. Inlined at build time: redeploy after changing it. |
| `NEXT_PUBLIC_LINE_OA_BASIC_ID` | Yes | `@490jvnda`, for the add-friend button. Inlined at build time. |
| `LINE_LOGIN_CHANNEL_ID` | No | `2011873191`. Defaults to the channel in `NEXT_PUBLIC_LIFF_ID`. |
| `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` | Yes | Atlas OA long-lived token: friendship check and the confirmation push. Without it, requests are still stored with `line_push_status = 'skipped'`. |
| `SUPABASE_URL` | Yes | Astly's Supabase project URL (`NEXT_PUBLIC_SUPABASE_URL` is also read). |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Astly's service-role key. Server-only; it bypasses RLS. Without the database, events are dropped and submitting fails. |

Development only (ignored by production builds, browser and server): `NEXT_PUBLIC_LIFF_MOCK=true` skips the LIFF SDK and signs in as `NEXT_PUBLIC_LIFF_MOCK_USER_ID` (default `Udeadbeef…`); `ATLAS_LIFF_MOCK_AUTH=true` lets the server accept that identity; `ATLAS_LIFF_MOCK_FRIEND=false` makes it a non-friend to show the add-friend screen. For a mock user, the confirmation is sent to LINE's validate endpoint instead of being pushed.

## Database

Run [`database/atlas_liff.sql`](database/atlas_liff.sql) once in the Astly Supabase SQL editor; re-running it is safe. A database set up before 2026-10-07 also needs [`database/atlas_liff_002_seller_address.sql`](database/atlas_liff_002_seller_address.sql) (seller address for ขายฝาก; also safe to re-run). Every object is prefixed `atlas_`. RLS is enabled with no policies and `anon`/`authenticated` have no grants, so only the service-role key can read or write.

| Table | One row per |
| --- | --- |
| `atlas_line_users` | LINE user: display name, picture, friend status, visit count, first/last seen |
| `atlas_valuation_sessions` | Valuation attempt, submitted or not: device, assessment answers (each with its answer time), Astly condition score and prices, asking price, sale type, furthest stage, and the first time each stage was reached |
| `atlas_liff_events` | Event (see below), with its visit, valuation, step, time and active duration |
| `atlas_sale_requests` | Submitted request: reference, contact (plus `contact_address` and `contact_postcode` for ขายฝาก only), consent time, product, verified or reported prices, asking price, sale type, follow-up `status` (`new` → `contacted` → `qualified` / `closed` / `rejected`) and LINE push outcome |

Views for analysis:

| View | Shows |
| --- | --- |
| `atlas_v_session_timings` | Per valuation: seconds on the condition questions, waiting for the estimate, deciding the asking price, choosing the sale type and filling the contact form; total time; asking price against the estimate |
| `atlas_v_step_durations` | Per screen: average, median and p90 active seconds |
| `atlas_v_daily_funnel` | Per day (Bangkok): LIFF opens, users, and how many valuations reached each stage, by sale type |

Writes go through two functions, `atlas_ingest_liff_events(jsonb)` and `atlas_submit_sale_request(jsonb)`, each one transaction. A session is frozen once its request is submitted: later snapshots (a delayed batch) no longer change it. Text is stripped of NUL characters before it is written, and a batch the database rejects is dropped rather than resent.

## Recorded events

| Event | When |
| --- | --- |
| `liff_opened` | First load of a LIFF window: OS, LINE version, app language, in-LINE or browser, chat context type, viewport, campaign parameters |
| `liff_reloaded` | A reload inside the same window |
| `friendship_checked`, `friend_gate_shown`, `friend_add_clicked`, `friend_add_result`, `friend_added` | The add-friend requirement |
| `step_viewed` / `step_left` | Each screen (web flow path). `step_left.duration_ms` is time the page was visible; `wallMs` is wall-clock time; `reason` is `navigate`, `hidden` or `closed` |
| The web flow's analytics events | `landing_viewed`, `valuation_started`, `device_selected`, `condition_question_answered` (per question), `condition_section_completed`, `valuation_calculated`, `valuation_failed` (with the error code), `valuation_result_viewed`, `seller_proceeded`, `expected_price_entered`, `transaction_intent_selected`, `seller_contact_viewed`, `valuation_request_submitted` |
| `liff_closed` | The completion screen's close button |

Event times come from the phone's clock, shifted onto the server's when they differ by more than two seconds. Events are sent in batches every few seconds, on every screen change, and with `keepalive` when the page is hidden or closed.

Example: asking price against the estimate, by sale type.

```sql
select transaction_intent, count(*), round(avg(expected_to_estimate_ratio), 2) as avg_ratio,
       round(avg(price_decision_seconds)) as avg_price_decision_s
from atlas_v_session_timings
where max_stage >= 5
group by transaction_intent;
```

## Code map

| Path | Role |
| --- | --- |
| `app/liff/` | The `/liff` route tree: `layout.tsx` mounts `LiffApp`; pages re-export the web pages |
| `components/liff/liff-app.tsx` | Sign-in, add-friend screen, error screens, step tracking |
| `lib/flow-paths.ts`, `lib/flow-navigation.tsx` | Keep navigation inside `/liff` while pages use web paths (`useFlowRouter`, `useFlowPathname`, `FlowLink`, `useFlowChannel`) |
| `lib/liff/client.ts` | LIFF SDK wrapper (loaded on demand), mock mode |
| `lib/liff/tracker.ts` | Event queue, step timing, stage times, valuation snapshot |
| `adapters/liff/request.ts`, `adapters/channel-request.ts` | Request submission: the server in LIFF, the mock on the web |
| `app/api/liff/{session,events,requests}/` | Server routes |
| `lib/server/liff-auth.ts`, `line-messaging.ts`, `liff-events.ts`, `atlas-db.ts` | ID-token verification and session tokens, Messaging API, input validation, PostgREST calls |
| `database/atlas_liff.sql` | Schema |

## Local testing

```bash
# .env.development.local (git-ignored)
NEXT_PUBLIC_LIFF_MOCK=true
ATLAS_LIFF_MOCK_AUTH=true
SUPABASE_URL=...                 # a test database with atlas_liff.sql applied
SUPABASE_SERVICE_ROLE_KEY=...
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=...   # optional: validates the Flex message with LINE
npm run dev
```

Open http://localhost:3000/liff. Real LINE sign-in only works on the endpoint URL's domain, so test it on the deployment from the LINE app.
