---
id: ADR-0001
status: accepted
date: 2026-11-07
summary: Pages are connected through Facebook Login by one Operator; Page tokens are stored AES-256-GCM encrypted in the database.
evidence: [RES-0001, RES-0003]
---

# Connect Pages through Facebook Login and store encrypted Page tokens

PageFleet connects Pages with a **"Connect Facebook"** button (Facebook Login, app in Development mode with Standard Access) used by the single Operator, who has full control of every Page. The server exchanges the login for a long-lived user token, lists the Operator's Pages, and stores each selected Page's access token **encrypted with AES-256-GCM in SQLite**, using a key from the `TOKEN_ENCRYPTION_KEY` environment variable. The app secret stays in `META_APP_SECRET`. This is chosen from the first real-Page proof of concept onward, not deferred.

## Considered options

- **Hand-copied Page tokens in `META_PAGE_TOKEN_*` environment variables** (the earlier MVP design): fastest to build, but tokens travel through Graph API Explorer, clipboards and `.env` files, are easy to paste onto the wrong Page, and every invalidation repeats the manual procedure for each Page. Rejected.
- **Business Portfolio system-user tokens**: avoid a personal login, but setup needs a Business Manager and, per Meta's overview, review/verification for the needed permissions. Rejected for one Operator and ten Pages; revisit if Pages move under several people.

## Consequences

- Encrypting with a key on the same machine protects copies and backups of the database, **not** a compromised host. Losing the key only means reconnecting.
- Meta allows plain-HTTP OAuth redirects only to `localhost` while the app is in Development mode, so connecting happens on the machine running PageFleet. Trusted-LAN (`--public`) users can use the app but cannot connect Pages; Internet/VPS use requires HTTPS.
- Standard Access serves only people with a role on the Meta app. Adding Pages managed by other people, or running the app in Live mode, requires App Review and Business Verification and a new decision.
- Long-lived Page tokens have no expiry date but can still be invalidated (for example, password change or app de-authorization). A Page whose token Meta rejects becomes **Needs reconnect** and cannot accept new schedules until reconnected.
