# PageFleet

A **local-first AI content studio** for up to ten Facebook Pages you manage. You write or import content ideas, PageFleet drafts a separate post for each Page, you review and approve them, and PageFleet hands them to **Facebook's own scheduler**. Once a post is scheduled on Facebook, it publishes even if your computer is off.

Current use: 10 Pages in two Industries (construction works and granite) owned by one company. The domain language is in [GLOSSARY.md](GLOSSARY.md).

> **Status.** Facebook Login and Meta-native scheduled posting work on real test Pages (November 2026); confirm image order on your own Pages with [section 6](#6-verify-real-scheduling). The spreadsheet Batch workflow, Page codes, Industries/Writing guides and the reconciliation view are planned. See [requirements](docs/requirements/product.md).

## Contents

1. [What you need](#1-what-you-need)
2. [Get the code](#2-get-the-code)
3. [First run without Facebook](#3-first-run-without-facebook)
4. [Explore the demo](#4-explore-the-demo)
5. [Connect your Facebook Pages](#5-connect-your-facebook-pages)
6. [Verify real scheduling](#6-verify-real-scheduling)
7. [Everyday use](#7-everyday-use)
8. [AI writing (optional)](#8-ai-writing-optional)
9. [Configuration reference](#9-configuration-reference)
10. [Share on your local network](#10-share-on-your-local-network)
11. [Data, backup and reset](#11-data-backup-and-reset)
12. [Troubleshooting](#12-troubleshooting)
13. [Development](#13-development)

## 1. What you need

| Item | Why | Check |
|---|---|---|
| **Node.js 22.13 or newer** | Runs the app; nothing else to install (no `npm install`) | `node --version` |
| **Git** with a GitHub SSH key | Get and update the code | `ssh -T git@github.com` prints "Hi …" |
| A **Facebook account** with full control of the Pages | Connects the Pages | — |
| A **Meta developer account** (free) | The Meta app that Facebook Login uses | [developers.facebook.com](https://developers.facebook.com) |
| A desktop browser on the **same computer** as PageFleet | Facebook Login only returns to `localhost` | — |

AI API keys are optional; a free offline draft mode works without any key.

## 2. Get the code

```sh
git clone git@github.com:tsuuanmi/pagefleet.git
cd pagefleet
git checkout dev          # day-to-day work happens on dev; main receives releases
```

If an existing clone asks for a GitHub password on `git push`, its remote uses HTTPS. Switch it to SSH:

```sh
git remote set-url origin git@github.com:tsuuanmi/pagefleet.git
```

If `ssh -T git@github.com` says `Permission denied (publickey)`, point SSH at your key in `~/.ssh/config`:

```
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github
  IdentitiesOnly yes
```

## 3. First run without Facebook

```sh
cp .env.example .env
node --env-file=.env src/server.mjs
```

Open **http://localhost:3088**. The first start creates `data/pagefleet.sqlite` and ten placeholder Pages ("Fanpage 1" … "Fanpage 10"). With `PUBLISHER=mock` (the default), nothing is ever sent to Facebook: "scheduled" means a local record only.

- `npm start` also works but does **not** read `.env`; always use `node --env-file=.env src/server.mjs` once you have settings.
- Stop the server with `Ctrl+C`. Restart it after every `.env` change.
- `node src/server.mjs --help` lists the command-line flags.

## 4. Explore the demo

```sh
node src/server.mjs --demo
```

The demo uses its own database (`data/demo/`), with ten sample Pages, five ideas and drafts in every state. It cannot publish to Facebook or call paid AI. Delete `data/demo/` while the server is stopped to reset it; your normal data is untouched.

## 5. Connect your Facebook Pages

PageFleet connects Pages through **Facebook Login** and stores Page tokens encrypted on your computer; you never copy a token by hand ([why](docs/decisions/ADR-0001-oauth-page-connection.md)).

### 5.1 Pages

Use Pages on which your Facebook account has **full control**. For a first test, create one or two new Pages (facebook.com → Pages → Create new Page). They may stay unpublished: Meta's API can post to unpublished Pages.

### 5.2 Create the Meta app (once)

1. At [developers.facebook.com](https://developers.facebook.com) → **My Apps → Create app**.
2. Choose the use case for **managing a Page** and the **Business** app type. A Business Portfolio is not required.
3. In the use case's permissions, add **`pages_show_list`**, **`pages_read_engagement`** and **`pages_manage_posts`**.
4. Add **Facebook Login**. In its **Settings → Valid OAuth Redirect URIs**, enter exactly:
   ```
   http://localhost:3088/oauth/callback
   ```
   (use your port if you changed `PORT`).
5. In **App settings → Basic**, copy the **App ID** and **App Secret**.
6. Keep the app in **Development mode**. Your Facebook account is the app's admin, so no App Review is needed for your own Pages. Pages managed by other people would require App Review.

Meta renames dashboard items from time to time; if your dashboard only offers "Facebook Login for Business" with a configuration ID, see [Troubleshooting](#12-troubleshooting).

### 5.3 Configure `.env`

Generate an encryption key for stored Page tokens:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Edit `.env`, remove the `#` in front of these lines and fill them in:

```sh
META_APP_ID=<App ID>
META_APP_SECRET=<App Secret>
TOKEN_ENCRYPTION_KEY=<the 64-character key you just generated>
META_GRAPH_VERSION=v26.0
PUBLISHER=meta
META_PUBLISH_ENABLED=1
```

- `v26.0` was Meta's latest Graph API version in November 2026; check [Meta's version list](https://developers.facebook.com/docs/graph-api/changelog/versions/) when updating.
- Never commit `.env` (it is git-ignored) or paste the secret, key or tokens into chats or tickets.
- If you lose `TOKEN_ENCRYPTION_KEY`, set a new one and press **Connect Facebook** again.

### 5.4 Connect and link

1. Start: `node --env-file=.env src/server.mjs`. If it stops with "PUBLISHER=meta requires …" or "TOKEN_ENCRYPTION_KEY must be 32 bytes", fix `.env`.
2. Open **http://localhost:3088** — `localhost`, not `127.0.0.1`.
3. **Fanpages → Facebook connection → Connect Facebook.** Log in, select your Pages, allow the permissions.
4. Back in PageFleet, the panel lists each Facebook Page as **Connected** with "can create content".
5. For each PageFleet Page, click **Cấu hình**, pick its **Facebook Page**, and save. The card then shows "Facebook: <Page name>". A Facebook Page can be linked to only one PageFleet Page.

If a Page later shows **Needs reconnect** (Facebook rejected its token, for example after a password change), press **Connect Facebook** again.

## 6. Verify real scheduling

With the server running in Meta mode, open a second terminal in the repository:

```sh
node test/live-schedule.mjs          # dry run: prints the plan only
node test/live-schedule.mjs --yes    # schedules REAL posts
```

For every linked Page it creates three test posts (text only, one image, three images numbered 1-2-3), approves them and schedules them **5 minutes apart starting 12 minutes from now**. Each post is marked `[PageFleet test #n]` and `#PageFleetTest` so you can delete it later. Options: `--gap 5`, `--start 12`, `--base http://localhost:3088`; set `APP_PASSWORD=...` in front if the app uses a password.

Then:

1. Check **Meta Business Suite → Planner**: the posts appear as scheduled.
2. Stop PageFleet or shut the computer down.
3. After the last scheduled time, check each Page: every post published on time, and the three-image post shows images in order 1 → 2 → 3.

Each run creates new posts. If a post fails, the script stops and never resubmits; check the **Lịch đăng** tab and Business Suite before running again.

## 7. Everyday use

The interface is being translated to English; until then, labels are in Vietnamese.

1. **Nội dung → + Tạo mới**: title, prompt for the AI, the Pages to post to. One draft (Post variant) is created per Page.
2. **Ảnh**: add up to 10 images (JPEG/PNG/WebP, 4 MB each) in posting order; they apply to every Page of that idea. Changing images cancels earlier approvals.
3. **✨ AI**: write the draft. "Mẫu offline · $0" is a free fill-in template, not AI; see [AI writing](#8-ai-writing-optional) for real models.
4. **Sửa** to edit, **Duyệt** to approve the exact current text. Any later edit requires approval again.
5. **Lên lịch**: pick a time **11 minutes to 29 days ahead**. In Meta mode this sends the post to Facebook's scheduler; the **Lịch đăng** tab shows its state and remote ID.

States in **Lịch đăng**:

| State | Meaning | What to do |
|---|---|---|
| Scheduled | Facebook accepted the scheduled post | Nothing; it publishes on time |
| Failed | Facebook rejected the request; nothing was created | Read the error, fix, schedule again |
| Unknown (Cần đối soát) | The request may or may not have reached Facebook | Check Business Suite first; never resend blindly |

**Spreadsheet import (current, interim format).** **Import CSV / Excel** accepts `.csv` or `.xlsx` (first sheet), up to 3 MB and 200 ideas. Columns: `title` (required), `brief`, `pages` (internal Page IDs such as `page-1;page-2`; empty means all ten). Image cells are only text hints. The planned format with Page codes, tags, ordered media and posting time is described in [REQ-0002](docs/requirements/product.md).

## 8. AI writing (optional)

Without keys, only the free template is available. To enable models, add to `.env`:

```sh
ANTHROPIC_API_KEY=...            # from platform.claude.com
ANTHROPIC_MODEL=<model id>
ANTHROPIC_INPUT_USD_PER_M=<current input price per million tokens>
ANTHROPIC_OUTPUT_USD_PER_M=<current output price per million tokens>
# and/or OPENAI_API_KEY, OPENAI_MODEL, OPENAI_INPUT_USD_PER_M, OPENAI_OUTPUT_USD_PER_M
AI_MONTHLY_REQUEST_LIMIT=200
AI_MONTHLY_CAP_USD=5
```

- Take model IDs and prices from the providers' official pricing pages; paid generation is refused until prices are set.
- The monthly limits are application safeguards, not a billing guarantee; also set a spending limit in the provider console.
- Keys stay on the server and are never sent to the browser.
- PageFleet uses provider **API keys** only, not ChatGPT/Claude/Gemini app logins.

## 9. Configuration reference

All settings are environment variables, normally in `.env` (see [.env.example](.env.example)).

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3088` | Port; also part of the Facebook redirect URI |
| `HOST` | `127.0.0.1` | Listen address; use `--public` for LAN |
| `DATA_DIR` | `./data` | Database and uploaded images |
| `PUBLISHER` | `mock` | `meta` sends to Facebook |
| `META_PUBLISH_ENABLED` | — | Must be `1` for Meta publishing (second switch) |
| `META_APP_ID`, `META_APP_SECRET` | — | Meta app for Facebook Login |
| `TOKEN_ENCRYPTION_KEY` | — | 32-byte key (64 hex chars) encrypting Page tokens |
| `META_GRAPH_VERSION` | `v26.0` | Graph API version |
| `APP_PASSWORD` | — | Login password; required (16+ chars) for LAN access |
| `PUBLIC_BASE_URL` | — | `https://…` origin when behind an HTTPS reverse proxy |
| `OPENAI_*`, `ANTHROPIC_*` | — | AI keys, model IDs and prices (section 8) |
| `AI_MONTHLY_REQUEST_LIMIT`, `AI_MONTHLY_CAP_USD` | `200`, `5` | Monthly AI safeguards |

Command-line flags: `--port N`, `--public` (alias `--lan`), `--host IP`, `--demo`, `--help`.

## 10. Share on your local network

```sh
APP_PASSWORD='a-unique-password-of-16+-chars' node --env-file=.env src/server.mjs --public
```

Others on the same trusted network open `http://<your-LAN-IP>:3088` (find it with `hostname -I` on Linux or `ipconfig` on Windows) and log in with the password. LAN traffic is **not encrypted**: use only on a trusted network, never port-forward it to the Internet. LAN users can use the app, but **Connect Facebook only works on the computer running PageFleet** (`localhost`). Public Internet or VPS hosting needs an HTTPS reverse proxy and `PUBLIC_BASE_URL`; this is not packaged yet.

## 11. Data, backup and reset

- Everything lives in `DATA_DIR` (default `data/`): `pagefleet.sqlite` (plus `-wal`/`-shm` files) and `media/`.
- **Backup:** stop the server, copy the whole `data/` folder and your `.env` to a safe place. Without the same `TOKEN_ENCRYPTION_KEY`, stored Page tokens cannot be read; you would simply reconnect.
- **Start over:** stop the server and delete `data/`. Posts already scheduled on Facebook stay scheduled there; manage them in Business Suite.
- **Disconnect all** (Fanpages) deletes stored tokens; you can also remove the app under Facebook → Settings → Business integrations.

## 12. Troubleshooting

| Symptom | Fix |
|---|---|
| `git push` asks for a password | Remote is HTTPS; switch to SSH ([section 2](#2-get-the-code)) |
| Server exits: `PUBLISHER=meta requires …` | Set `META_APP_ID`, `META_APP_SECRET`, `TOKEN_ENCRYPTION_KEY` |
| Facebook connection panel says **Not configured** | Started without `--env-file=.env`, or those variables are empty |
| "Open http://localhost:3088 … to connect Facebook" | You used `127.0.0.1` or a LAN address; open `localhost` on the server computer |
| Facebook shows "URL blocked" / redirect_uri error | Redirect URI must match exactly, including the port |
| "Invalid Scopes" or no Pages after connecting | Add the three permissions to the app's use case; select the Pages during login |
| Login dialog asks for a configuration ID | The app uses "Facebook Login for Business"; this flow is not supported yet — report it |
| Page shows **Needs reconnect** | Press **Connect Facebook** again |
| "Schedule 11 minutes to 29 days ahead" | Pick a time inside that window |
| A delivery is **Unknown** | Check Business Suite before doing anything else |
| "Unexpected server error" | See the server terminal for the `[pagefleet]` line and report it |

## 13. Development

```sh
npm run check                    # syntax + offline tests (no Facebook, no paid AI)
python3 tools/docs.py check      # documentation structure and links
python3 tools/docs.py sync --check
python3 tools/docs.py impact <base-ref>   # needs Python 3.9+
```

Branches: work on feature branches merged into **`dev`**; `dev` is fast-forwarded to `main` for releases:

```sh
git checkout main && git pull --ff-only && git merge --ff-only origin/dev && git push origin main
```

Further reading: [documentation router](docs/README.md), [MVP architecture and limits](docs/architecture/mvp.md), [requirements](docs/requirements/product.md), [decisions](docs/decisions/README.md), [source map](src/README.md), [agent instructions](AGENTS.md).
