# PageFleet

A **local-first AI content studio** for ten authorized Facebook Pages. **MVP is under review in stacked PR #2**, not yet on main.

Initial use case: 10 Pages in two Industries (construction works and granite) owned by one company. Planned flow: connect Pages with Facebook Login -> import a spreadsheet Batch or enter a Content idea -> AI-written per-Page variants -> review and approve the Batch -> Meta-native scheduling -> reconcile uncertain outcomes.

## Start locally

1. Install **Node.js 22.13+**; no dependency installation is required.
2. `cp .env.example .env` and review the settings. The core app does **not** automatically load `.env`; use `node --env-file=.env src/server.mjs` if you configured one.
3. `npm start` (without .env) or `node --env-file=.env src/server.mjs` to use environment settings.
4. Open **http://127.0.0.1:3088**. The first launch seeds ten editable demonstration Page Profiles and creates `data/pagefleet.sqlite`. Never commit `data/` or `.env`.
5. Create an idea, select destination Pages, generate a free template draft, edit it, approve the exact revision and schedule with **Mock Publisher**.

`npm run check` validates syntax, tests and import logic. The documentation router is [docs/README.md](docs/README.md).

## Explore the demo

```bash
npm start -- --demo --port 3088
```

Open http://127.0.0.1:3088. Demo records are stored **separately** in `data/demo/pagefleet.sqlite` and created only when that demo database has no ideas. The demo starts with **10 named sample Pages, 5 content ideas, distinct Page-specific drafts, approved variants, and mock scheduled deliveries**. Explore the **Tổng quan / Nội dung / Fanpages / Lịch đăng** tabs; edit, create a free offline draft, approve its exact revision, and try **Lên lịch**. The demo **cannot publish to Facebook** and forbids paid AI generation. The orange/green statuses refer to mock records only, not live Facebook posts.

To reset the demo (while the server is stopped), delete **only** `data/demo/`; it will be recreated on the next `--demo` start. Normal local data under `data/pagefleet.sqlite` is unaffected. For another data root, configure `DATA_DIR`.

## Light / dark appearance

Use the **☾ Dark / ☀ Light** button in the header. The theme initially follows your browser/system preference and stores your selection in browser local storage. It works in both ordinary and demo mode; it does not change shared Page data.

## Share the demo on a trusted LAN

```bash
APP_PASSWORD='replace-with-a-unique-strong-password' npm start -- --demo --public --port 3088
```

The server listens on `0.0.0.0:3088`; peers can browse `http://<YOUR-LAN-IP>:3088`, using the same password. Find your machine's **private LAN IP** using `hostname -I` on many Linux systems, `ipconfig` on Windows, or your operating system's network settings. Allow the port through your **local firewall** only for trusted LAN clients.

`--port N` selects the port; `--public` (or `--lan`) is required to listen on all network interfaces. To bind an explicit interface, use `--public --host 192.168.1.20 --port 3088`. **Do not port-forward this HTTP service, publish it to the Internet, or use an untrusted Wi-Fi network:** the password and data are not encrypted over LAN HTTP. Non-loopback binding requires a 16+ character `APP_PASSWORD`. Use HTTPS + `PUBLIC_BASE_URL` behind a reverse proxy before exposing beyond trusted LAN. `--demo` requires `PUBLISHER=mock`; no Meta posting happens from demo mode. Other LAN users can edit demo content; this is single-operator authentication, not user separation.

Use `npm start -- --help` to see flags.

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

**Meta trial is an opt-in experimental integration, not validated live.** Pages are connected with **Connect Facebook** ([ADR-0001](docs/decisions/ADR-0001-oauth-page-connection.md)); no token is ever copied by hand.

1. Create a Meta app (Business type) at developers.facebook.com, keep it in **Development mode**, add **Facebook Login** with redirect URI `http://localhost:3088/oauth/callback` (match your port). Your Facebook account must be an app admin/developer and have full control of the Pages; unpublished test Pages are fine.
2. Set `META_APP_ID`, `META_APP_SECRET` and `TOKEN_ENCRYPTION_KEY` (see `.env.example`), plus `PUBLISHER=meta`, `META_PUBLISH_ENABLED=1` and a supported `META_GRAPH_VERSION`.
3. Open **http://localhost:3088** on the same computer, go to **Fanpages → Connect Facebook**, approve the Pages, then use **Cấu hình** to link each PageFleet Page to a connected Facebook Page.

The app uses Meta native scheduling: images are uploaded as temporary unpublished photos and attached in order to a scheduled `/feed` post. **No promise of Page access, photo support or successful posting is made.** Any unknown remote outcome is recorded and blocked from blind repeat; check Meta Business Suite manually.

Local workstation can close *after Meta accepts a native scheduled post*, but cannot create or send future jobs while closed. A VPS is optional for future fully unattended queue refill and collaboration.

## VPS later

Single-process Node app, persistent `DATA_DIR`, backup of SQLite DB + media, and authentication at an HTTPS reverse proxy. Trusted LAN `--public` binding requires `APP_PASSWORD` (16+ characters) and displays a plaintext-HTTP warning. Internet/VPS exposure requires an HTTPS reverse proxy with `PUBLIC_BASE_URL=https://...` (and the password). Do not expose an unauthenticated local instance through a tunnel. No production Docker or backup automation is included in this MVP yet.

Current limitations and trust boundaries are recorded in [MVP architecture](docs/architecture/mvp.md); [research](docs/research/README.md) is not accepted architecture.

The domain language is in [GLOSSARY.md](GLOSSARY.md); accepted rationale is in [decisions](docs/decisions/README.md).
