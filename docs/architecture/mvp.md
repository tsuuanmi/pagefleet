---
type: architecture
status: draft
summary: Implemented local MVP boundaries, safety invariants and deployment limitations.
implements: [requirements/product]
decided-by: [ADR-0001]
covers: [src/server.mjs, src/cli.mjs, src/demo.mjs, src/db.mjs, src/logic.mjs, src/import.mjs, src/providers.mjs, src/meta.mjs, src/public/app.js, src/public/style.css, src/public/index.html, test/core.test.mjs, test/cli-demo.test.mjs, test/meta.test.mjs]
reviewed: 2026-11-07
---

# Local-first MVP implementation (PR #2)

**Scope:** the software on the `feat/local-first-mvp` branch; features are not deployed to main. See [requirements](../requirements/product.md), [research](../research/README.md) and the still-unaccepted [initial proposal](../proposals/PROP-0001-local-first-mvp.md). This document records implemented boundaries, not proven ability to publish on real Pages.

## Runtime and data

Node.js 22.13+ built-in HTTP server and SQLite (`node:sqlite`), no npm runtime dependencies. Single process and SQLite WAL database in `DATA_DIR`; binary image files are stored in its `media/` subfolder. Ten **example** Page profiles are seeded on a new database. With `--demo`, ten realistic sample Pages, five ideas, per-Page variants and approved/scheduled *mock* examples are seeded into a distinct `DATA_DIR/demo` database. This demo disables paid AI and Meta publishing. It is never silently mixed with normal local data. UI uses server-rendered snapshots of state via JSON plus a static browser frontend; no third-party CDN.

`ContentIdea` holds title, brief, image hints and up to ten uploaded images in a fixed order. Each selected Page gets a `PostVariant` with editable text, revision, approval revision and Page-specific inputs. `Delivery` contains provider, intended ISO UTC schedule, state, remote ID and result. `Usage` records provider/model/token/cost for AI calls.

## Trust boundary

The server owns SQLite, provider tokens and file paths. It binds to `127.0.0.1` by default. `--port` changes the port; `--public` enables trusted-LAN binding on `0.0.0.0` (or `--host` for a specific IP) only with a 16+ character `APP_PASSWORD`. LAN HTTP is **unencrypted** and must never be port-forwarded. For Internet/VPS exposure, use `PUBLIC_BASE_URL=https://...` and an authenticated TLS reverse proxy. A conservative Host/Origin check limits plain HTTP requests to private IPs/localhost and the bound port. Password-authenticated browser sessions use a HttpOnly SameSite=Strict cookie (Secure when HTTPS configured), in-memory session hashes and a same-origin/custom-header request check for mutations. This is **single-operator MVP**, not multi-tenant user/role control. Do not expose a local unauthenticated instance through a public tunnel.

Media MIME is checked against file signatures with a 4 MB binary limit (JSON/base64 requests allow the encoded overhead) and stored under generated filenames, never as executable user paths. Import parsing is bounded. Page tokens come only from **Connect Facebook** ([ADR-0001](../decisions/ADR-0001-oauth-page-connection.md)): the OAuth `state` is a one-time server value created by an authenticated `/oauth/start` and expires after 10 minutes; the callback is authorized by that state because Meta's cross-site redirect does not carry the SameSite=Strict session cookie. The server exchanges the code for a long-lived user token, lists the Operator's Pages, and stores each Page token AES-256-GCM encrypted (`TOKEN_ENCRYPTION_KEY`, Meta Page ID as associated data) in `meta_pages`; the user token is discarded. Graph calls carry `appsecret_proof` and send tokens in request bodies for POSTs. Tokens never reach the browser or logs. A Page is linked to a connected Facebook Page only if the Operator's role includes `CREATE_CONTENT`, and a Facebook Page links to at most one Page. Plain-HTTP OAuth works only from `http://localhost:PORT`; LAN users can use the app but cannot connect.

## Workflow and safety

1. Create idea by form or CSV/XLSX (first-sheet only; 200 ideas/file limit, error list).
2. Tailor selected `PostVariant` text using offline template or Claude/OpenAI Responses/Messages APIs; `AI_MONTHLY_REQUEST_LIMIT` and `AI_MONTHLY_CAP_USD` apply to priced providers. Prices must be configured; text provider usage recorded.
3. Editing regenerates a revision, invalidates any previous approval, and requires explicit approval of the current revision before submission.
4. Schedule between 11 minutes and 29 days in future with timezone-aware ISO input; reserve a persistent delivery *before* any network call.
5. Mock Publisher records a scheduled fake remote ID. The opt-in Meta Publisher uploads each image to `/{page}/photos` with `published=false` and `temporary=true`, then creates the post on `/{page}/feed` with `published=false`, `scheduled_publish_time`, `unpublished_content_type=SCHEDULED` and `attached_media[i]` in image order, as Meta's photos reference describes for scheduled multi-photo posts. A real Page test is **still needed** to confirm permissions, the actual Graph API version and status reconciliation.
6. If Meta answers with an HTTP 4xx error body, the request did not take effect and the delivery is **failed** (temporary photos expire on Meta's side); error code 190 also marks the Facebook Page **needs_reconnect**, which blocks new schedules until Connect Facebook succeeds again. If the outcome is uncertain (timeout, network error, 5xx, unreadable reply or process crash), mark delivery **unknown** and block automatic retries. **No automatic remote reconciliation yet**: user must verify in Meta Business Suite. This means some delivery states can remain uncertain. Mock scheduled status does not mean a live post.
7. No background worker is required for posts already accepted into Meta native scheduling; this server does **not** auto-generate or submit new drafts while closed. A VPS is optional until that behavior is needed.

## Display and demo

The UI supports an explicit light/dark toggle with a system-default initial preference and per-browser localStorage choice. No external theme dependency is added. The separate `--demo` workspace presents an end-to-end walkthrough with fake Page names and scheduled mock deliveries, but **no real Facebook posts, paid AI requests or live delivery confirmation**. Demo may be reset by deleting the isolated demo directory while stopped.

## Current limitations

- Facebook Login, native scheduling, the multi-photo flow and remote read-back are **not verified on a real Page**; API version is configurable. Only one Operator account connects; adding Pages managed by others needs App Review (see ADR-0001).
- No image generation, video, Reels, analytics, cancellation/edits of remotely scheduled posts, automated scheduled-post state reconciliation, retry/release UI, per-person approval/roles, or offsite backup built in.
- CSV/XLSX image cell values are hints; users add images in order (or remove all) via the variant's **Ảnh** action, which updates the parent idea and invalidates previous approvals. XLSX expects first worksheet in `xl/worksheets/sheet1.xml`; some workbook layouts need normalization.
- No automatic delivery at due time in mock mode (it only records scheduling); Meta is the only intended native scheduling service.
- Generated output quality depends on the model and editor; the offline template is a fill-in draft, **not generative AI**.
- Budget caps are best-effort and conservative for a single process; usage billing may occur even if a provider request times out. Do not assume precise hard billing limits.
- The Node app is configured for a single process and single operator; do not scale to multiple instances without migrating session handling and locks.

## Commands

- `node src/server.mjs` / `npm start` (Node 22.13+); `npm start -- --demo --port 3088` or `APP_PASSWORD='...' npm start -- --demo --public --port 3088` for LAN.
- `npm test` and `npm run check` (offline)
- `python3 tools/docs.py check`, `python3 tools/docs.py sync --check`, `python3 tools/docs.py impact <base-ref>` for documentation.

Local start details: [root README](../../README.md). The existing research and proposal remain exploratory.
