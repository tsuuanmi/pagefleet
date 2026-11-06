---
type: architecture
status: draft
summary: Implemented local MVP boundaries, safety invariants and deployment limitations.
implements: [requirements/product]
covers: [src/server.mjs, src/cli.mjs, src/demo.mjs, src/db.mjs, src/logic.mjs, src/import.mjs, src/providers.mjs, src/public/app.js, src/public/style.css, src/public/index.html, test/core.test.mjs, test/cli-demo.test.mjs]
reviewed: 2026-11-06
---

# Local-first MVP implementation (PR #2)

**Scope:** the software on the `feat/local-first-mvp` branch; features are not deployed to main. See [requirements](../requirements/product.md), [research](../research/README.md) and the still-unaccepted [initial proposal](../proposals/PROP-0001-local-first-mvp.md). This document records implemented boundaries, not proven ability to publish on real Pages.

## Runtime and data

Node.js 22.13+ built-in HTTP server and SQLite (`node:sqlite`), no npm runtime dependencies. Single process and SQLite WAL database in `DATA_DIR`; binary image files are stored in its `media/` subfolder. Ten **example** Page profiles are seeded on a new database. With `--demo`, ten realistic sample Pages, five ideas, per-Page variants and approved/scheduled *mock* examples are seeded into a distinct `DATA_DIR/demo` database. This demo disables paid AI and Meta publishing. It is never silently mixed with normal local data. UI uses server-rendered snapshots of state via JSON plus a static browser frontend; no third-party CDN.

`ContentIdea` holds title, brief, image hints and one optional uploaded image. Each selected Page gets a `PostVariant` with editable text, revision, approval revision and Page-specific inputs. `Delivery` contains provider, intended ISO UTC schedule, state, remote ID and result. `Usage` records provider/model/token/cost for AI calls.

## Trust boundary

The server owns SQLite, provider tokens and file paths. It binds to `127.0.0.1` by default. `--port` changes the port; `--public` enables trusted-LAN binding on `0.0.0.0` (or `--host` for a specific IP) only with a 16+ character `APP_PASSWORD`. LAN HTTP is **unencrypted** and must never be port-forwarded. For Internet/VPS exposure, use `PUBLIC_BASE_URL=https://...` and an authenticated TLS reverse proxy. A conservative Host/Origin check limits plain HTTP requests to private IPs/localhost and the bound port. Password-authenticated browser sessions use a HttpOnly SameSite=Strict cookie (Secure when HTTPS configured), in-memory session hashes and a same-origin/custom-header request check for mutations. This is **single-operator MVP**, not multi-tenant user/role control. Do not expose a local unauthenticated instance through a public tunnel.

Media MIME is checked against file signatures with a 4 MB binary limit (JSON/base64 requests allow the encoded overhead) and stored under generated filenames, never as executable user paths. Import parsing is bounded. Do not store any token in the browser or database; Page records contain only the name of the server environment variable that holds the token.

## Workflow and safety

1. Create idea by form or CSV/XLSX (first-sheet only; 200 ideas/file limit, error list).
2. Tailor selected `PostVariant` text using offline template or Claude/OpenAI Responses/Messages APIs; `AI_MONTHLY_REQUEST_LIMIT` and `AI_MONTHLY_CAP_USD` apply to priced providers. Prices must be configured; text provider usage recorded.
3. Editing regenerates a revision, invalidates any previous approval, and requires explicit approval of the current revision before submission.
4. Schedule between 11 minutes and 29 days in future with timezone-aware ISO input; reserve a persistent delivery *before* any network call.
5. Mock Publisher records a scheduled fake remote ID. The opt-in Meta Publisher sends native `published=false` and `scheduled_publish_time` on the Page's `/feed`, with optional image upload + `attached_media`. A real Page test is **still needed** to confirm the media combination, permissions, actual Meta API version and status reconciliation.
6. If Meta request outcome is uncertain (including an error after a remote send or process crash), mark delivery **unknown** and block automatic retries. **No automatic remote reconciliation yet**: user must verify in Meta Business Suite. This means some delivery states can remain uncertain. Mock scheduled status does not mean a live post.
7. No background worker is required for posts already accepted into Meta native scheduling; this server does **not** auto-generate or submit new drafts while closed. A VPS is optional until that behavior is needed.

## Display and demo

The UI supports an explicit light/dark toggle with a system-default initial preference and per-browser localStorage choice. No external theme dependency is added. The separate `--demo` workspace presents an end-to-end walkthrough with fake Page names and scheduled mock deliveries, but **no real Facebook posts, paid AI requests or live delivery confirmation**. Demo may be reset by deleting the isolated demo directory while stopped.

## Current limitations

- Real Meta permissions/tokens, native scheduling, photo flow and remote read-back are **not verified**; API version is configurable.
- No image generation, video, Reels, analytics, cancellation/edits of remotely scheduled posts, automated scheduled-post state reconciliation, retry/release UI, per-person approval/roles, or offsite backup built in.
- CSV/XLSX image cell values are hints; users upload binary images via the variant's **Ảnh** action, which updates the parent idea and invalidates previous approvals. XLSX expects first worksheet in `xl/worksheets/sheet1.xml`; some workbook layouts need normalization.
- No automatic delivery at due time in mock mode (it only records scheduling); Meta is the only intended native scheduling service.
- Generated output quality depends on the model and editor; the offline template is a fill-in draft, **not generative AI**.
- Budget caps are best-effort and conservative for a single process; usage billing may occur even if a provider request times out. Do not assume precise hard billing limits.
- The Node app is configured for a single process and single operator; do not scale to multiple instances without migrating session handling and locks.

## Commands

- `node src/server.mjs` / `npm start` (Node 22.13+); `npm start -- --demo --port 3088` or `APP_PASSWORD='...' npm start -- --demo --public --port 3088` for LAN.
- `npm test` and `npm run check` (offline)
- `python3 tools/docs.py check`, `python3 tools/docs.py sync --check`, `python3 tools/docs.py impact <base-ref>` for documentation.

Local start details: [root README](../../README.md). The existing research and proposal remain exploratory.
