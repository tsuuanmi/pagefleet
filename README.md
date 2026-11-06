# PageFleet

A **local-first AI content studio** for ten authorized Facebook Pages. Seven Pages may share a subject but maintain distinct audiences, voices and post variants. The other three can have separate topics. **MVP is under review in stacked PR #2**, not yet on main.

## Start locally

1. Install **Node.js 22.13+**; no dependency installation is required.
2. `cp .env.example .env` and review the settings. The core app does **not** automatically load `.env`; use `node --env-file=.env src/server.mjs` if you configured one.
3. `npm start` (without .env) or `node --env-file=.env src/server.mjs` to use environment settings.
4. Open **http://127.0.0.1:3088**. The first launch seeds ten editable demonstration Page Profiles and creates `data/pagefleet.sqlite`. Never commit `data/` or `.env`.
5. Create an idea, select destination Pages, generate a free template draft, edit it, approve the exact revision and schedule with **Mock Publisher**.

`npm run check` validates syntax, tests and import logic. The documentation router is [docs/README.md](docs/README.md).

## CSV and Excel

Supports `.csv` or `.xlsx` (first worksheet), maximum 3 MB and 200 ideas per import. Required column: `title`; optional columns: `brief` / `hint` / `notes`, `pages` (e.g. `page-1;page-2`), `image` / `image_hint`. No Pages column means all ten. Sample CSV:

```csv
title,brief,pages,image_hint
Packing tips,Explain recyclable cartons,page-1;page-2,carton.jpg
Printer guide,Focus on precision,page-8,print.jpg
```

Images from spreadsheet cells are **hints**; use the media endpoint/upload feature separately for binary files. Do not import sensitive customer data you do not have permission to process.

## AI options

The free offline `template` mode uses provided text, audience and CTA; it is not generative AI. Optional OpenAI or Claude generation is available with server environment variables `OPENAI_API_KEY`/`OPENAI_MODEL` or `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`. Also set `OPENAI_INPUT_USD_PER_M` and `OPENAI_OUTPUT_USD_PER_M`, or Anthropic equivalents, from **current** provider prices before paid calls. Monthly caps: `AI_MONTHLY_REQUEST_LIMIT=200`, `AI_MONTHLY_CAP_USD=5` by default; these are protective best-effort application limits, not a hard billing guarantee. Observe token cost in dashboard.

## Publishing: start safe

Default: `PUBLISHER=mock`. No Facebook posts are sent. Mock posts remain `scheduled` in local records and are **not** actually published.

**Meta trial is an opt-in experimental integration, not validated live:** use an authorized Page and configure each Page's numeric `meta_page_id` and `token_env` in UI; place the matching Page access token in a server environment variable named `META_PAGE_TOKEN_...`. Set `PUBLISHER=meta`, `META_PUBLISH_ENABLED=1` and an actually supported `META_GRAPH_VERSION` for the selected endpoint. Use a real controlled test Page first. The app attempts native scheduling (`published=false`, `scheduled_publish_time`) on Meta's feed endpoint, optionally with a staged photo. **No promise of Page access, photo support or successful posting is made.** Any unknown remote outcome is recorded and blocked from blind repeat; check Meta Business Suite manually.

Local workstation can close *after Meta accepts a native scheduled post*, but cannot create or send future jobs while closed. A VPS is optional for future fully unattended queue refill and collaboration.

## VPS later

Single-process Node app, persistent `DATA_DIR`, backup of SQLite DB + media, and authentication at an HTTPS reverse proxy. Non-loopback binding requires `APP_PASSWORD` (16+ characters) and `PUBLIC_BASE_URL=https://...`. Do not expose an unauthenticated local instance through a tunnel. No production Docker or backup automation is included in this MVP yet.

Current limitations and trust boundaries are recorded in [MVP architecture](docs/architecture/mvp.md); [research](docs/research/README.md) is not accepted architecture.
