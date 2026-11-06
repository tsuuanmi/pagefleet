---
type: research
id: RES-0003
status: active
date: 2026-11-06
summary: Authorized zero-subscription publishing options, native scheduling and feasibility gates.
related: [RES-0001, RES-0002]
---

# Zero-subscription Facebook publishing paths

**Research, not a tested integration. Reviewed 2026-11-06.** The target is ten *Facebook Pages*, not Groups or personal profiles, operated with legitimate Page permissions. The financial models are in [RES-0002](RES-0002-cost-model.md); this file owns the platform mechanisms, prerequisites and verification plan.

## Key hypothesis: Meta-native scheduled posts remove the always-on scheduler

The [official Meta Pages API posts guide](https://developers.facebook.com/documentation/pages-api/posts) and [Social SDK's Facebook adapter documentation](https://social-sdk.dev/docs/platforms/facebook) describe `published=false` plus `scheduled_publish_time` for supported Page posts. If Meta accepts a scheduled delivery and returns a post ID, **Meta's servers** publish at the future time. PageFleet's workstation need not be online at the due time; a VPS/cron/Redis/Temporal worker is *not* needed solely to fire that pre-submitted post.

**Critical limits:**
- Documented schedule windows vary by API guide, endpoint and media format; the Pages posts guide and SDK conservatively use **10 minutes to 30 days for feed/photo posts**. Other references report different maxima. Validate against the actual Graph API version/media endpoint; do not promise longer without a live test.
- This does **not** create or submit new posts while PageFleet is offline; review, queue refill beyond the accepted window, reminders and error reconciliation still need a human online or a future always-on worker.
- Verify that the actual *photo workflow* accepts native schedules, not just text. Test attachment availability, timezone, cancellation and `/scheduled_posts` read-back for the live Page.
- Treat an API timeout after submission as **unknown**: query remote state before retrying. Do not accidentally double-post.

This is a high-value possibility that changes the economics and deployment sequence, **not yet confirmed for the owner's ten Pages**.

## Authorization is the gate, not a subscription

The [Meta permissions reference](https://developers.facebook.com/docs/permissions/reference) identifies `pages_manage_posts` (create/edit/delete Page posts), with `pages_read_engagement` and `pages_show_list` dependencies. The person/token must have the correct Page task, not simply know the password.

- **Own/manage Page as app role:** sources describing Standard Access indicate that a developer/tester/admin of the same Meta app can often publish to Pages they manage without third-party Advanced Access review; must verify with the actual Meta app, person and asset configuration.
- **Client-owned Pages/other app users:** Advanced Access / App Review and possibly business verification may be needed. Do **not** assume a single operator's claim to 'manage ten Pages' establishes app role, Page task or approval eligibility.
- Recheck Meta [Pages API](https://developers.facebook.com/docs/pages-api/), [permissions](https://developers.facebook.com/docs/permissions/reference), and app dashboard before implementation. A tool that wraps the API **cannot** bypass permission requirements.
- Page tokens are credentials. Keep server-side, scope by Page, monitor validity and handle revocation/reconnection; 'long-lived' does not mean guaranteed to work forever.

**Permission test:** use a consented test Page and the actual authorized operator. Record the `/me/accounts` Page list, granular scopes/assigned tasks, status/error on one text post and one scheduled photo. Never collect passwords or use hidden browser automation.

## Ranked options

| Option | Channel subscription | Laptop can close after scheduling? | What it solves | Real blocker / trade-off |
|---|---|---|---|---|
| **Direct Meta Graph API + native schedule** | No publisher fee expected | **Yes, if post accepted by Meta** | Cheapest targeted custom workflow; own editor/Excel/AI | Permission/approval, token lifecycle, schedule window, maintaining adapter |
| [Social SDK](https://social-sdk.dev/docs/platforms/facebook) + direct Meta | MIT SDK, no per-Page SDK fee | Yes, using native schedule | TypeScript adapter, Mock backend, typed results, reconciled unknown states | Still needs *own Meta app and Page tokens*; adapter's contract tests are not proof of production Page access |
| [Meta Business Suite](https://www.facebook.com/business/tools/meta-business-suite) | Free | Yes | Official UI fallback for Page scheduling, zero engineering | Manual per-post composer; no general Excel bulk scheduling or PageFleet API. See [Buffer's comparison](https://buffer.com/resources/buffer-vs-meta-business-suite/) |
| [Activepieces Facebook Pages](https://www.activepieces.com/mcp/facebook-pages) | Free community/self-host options, subject to plan limits | Only for posts natively scheduled at Meta or when runtime stays on | Create Page Post/Photo/Video actions, OAuth, rapid workflow POC | Verify schedule support in action; otherwise needs running flow and still needs Meta-approved connection. [Community core MIT](https://github.com/activepieces/activepieces) |
| [Mixpost Lite](https://mixpost.app/pricing) | Free Lite, unlimited accounts advertised | Its scheduler generally needs hosting running | Ready-made Facebook publishing UI/calendar, media, post variants | Laravel/Vue, host resources and Meta app; AI, queue/approval/API features distinguish Pro |
| [n8n Community](https://support.n8n.io/article/can-i-use-your-license-for-my-use-case) | No n8n Community subscription for permitted self-host usage | Requires runtime unless directly scheduling via Meta | Spreadsheet -> AI -> approval -> Graph API prototype | SUL terms: exposing workflow configuration to external clients (including via own UI/API/agent) may require commercial license |
| [Postiz](https://github.com/gitroomhq/postiz-app) | Free source AGPL-3.0, self-host costs | Scheduler requires uptime | Most complete API/social/agent infrastructure | More services incl. Redis/Temporal; more deployment/maintenance and AGPL obligations |
| Browser bot/login session | Not recommended | Unreliable | May appear to avoid developer API | UI fragility, account/ToS/security risk; not an acceptable 'free workaround' |

**Evidence limitations:** product documentation may not match a particular user's OAuth eligibility. Nothing listed has been installed or tested in PageFleet yet. Facebook Graph API may be free for ordinary organic Page publishing, but terms, usage quotas and special products must be checked.

## Free AI as a *separate* cost lever

The publishing solution should not dictate LLM choice. Use a provider abstraction so operator can pick:
- [Ollama local](https://ollama.com/): no per-token cloud invoice for local models, but hardware/energy/quality/latency costs.
- [Gemini API free-tier eligible models](https://ai.google.dev/gemini-api/docs/pricing): $0 for certain model calls *within current regional/project limits*; review data handling and free-tier restrictions.
- [Groq free-tier rate limits](https://console.groq.com/docs/rate-limits): specific RPM/RPD/TPM/TPD limits; not a production SLA.
- Claude/OpenAI for measurable low-cost drafts and higher-quality fallback; see [cost model](RES-0002-cost-model.md).

Do not bypass quotas through multiple accounts or rely on promotional free credits for production. Reuse user-supplied images rather than paying for image generation initially.

## Prioritized experiment matrix

1. **Access gate:** determine exact ownership, app roles, Page tasks, scopes and app state for all ten Pages; record Standard/Advanced implications.
2. **Text native schedule:** submit approved text on one test Page for 20+ minutes ahead; record ID, intended UTC time, read-back status.
3. **Photo native schedule:** submit a real uploaded image and caption to same Page; confirm media association and scheduled publication.
4. **Offline test:** close laptop/network until after scheduled time; reopen, read back remote post URL and published state.
5. **Failure safety:** token revocation, invalid scopes, timezone roundtrip, duplicate-key attempts, cancellation, timeout/unknown response and reconciliation.
6. **SDK evaluation:** compare direct minimal HTTP adapter to MIT Social SDK on effort, API compatibility, abstraction and test coverage. Do not fork an entire scheduling app first.
7. **Alternative gates:** if direct access cannot be approved soon, compare free manual Meta Business Suite and a limited Activepieces POC; introduce Buffer paid only with a documented break-even decision.
8. **Expansion:** pilot two Pages, then all ten, with per-Page post-quality review and record of operator time.

## Working deployment consequence

**Local v0 can be useful without VPS**: import/AI/review/submit future posts and safely exit. VPS becomes justified only for automatic *creation and submission of new posts while no person is present*, remote collaboration, continuously refilling schedules, cross-platform delivery or always-on monitoring. This is different from generic scheduler architectures and should be verified before building a job queue.

References: [Meta Pages API](https://developers.facebook.com/documentation/pages-api/posts), [Meta permissions](https://developers.facebook.com/docs/permissions/reference), [Social SDK Facebook](https://social-sdk.dev/docs/platforms/facebook), [Activepieces Facebook Pages](https://www.activepieces.com/mcp/facebook-pages), [Mixpost Lite pricing/features](https://mixpost.app/pricing), [n8n licensing](https://support.n8n.io/article/can-i-use-your-license-for-my-use-case), [Meta policy on originality](https://about.fb.com/news/2026/03/rewarding-original-creators-on-facebook/).
