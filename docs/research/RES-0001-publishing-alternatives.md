---
type: research
id: RES-0001
status: active
date: 2026-11-06
summary: Reusable projects and authorized Facebook publishing options.
---

# Publishing alternatives — research snapshot

Verified/reviewed on **2026-11-06**. No end-to-end publishing has been tested in PageFleet. For desired behavior see [requirements](../requirements/product.md).

| Candidate | Useful patterns | Limitations and next test |
|---|---|---|
| [Buffer API](https://developers.buffer.com/guides/introduction.html) | Public GraphQL, channels, media posts, scheduling, delivery status, fast integration | Ten channels require paid tier; test OAuth/account connection, request limits, image post and status |
| [Postiz](https://github.com/gitroomhq/postiz-app) | Multi-provider integrations, self-hosted schedule, API, media, operations | AGPL-3.0, service/maintenance footprint, Meta authentication still required |
| [Mixpost Lite](https://github.com/inovector/mixpost) | Calendar, composer, media and accounts; MIT | Laravel/Vue; distinguish Lite from Pro features and inspect vendor/Meta auth |
| [n8n templates](https://n8n.io/workflows/) | Rapid spreadsheet -> LLM -> approval -> publishing prototype | Community templates may be stale; verify licenses, functionality and terms |
| [Official Meta Pages API](https://developers.facebook.com/docs/pages-api/) | Direct adapter, no publisher subscription required in principle | Verify app access/review, permissions, Page tokens, rate limits and actual endpoint |
| Browser-based automation | No preferred reuse | UI fragility and policy/auth risk; do not select as workaround |

Primary documentation: [Buffer posts and scheduling](https://developers.buffer.com/guides/posts-and-scheduling.html), [Buffer API help](https://support.buffer.com/articles/using-buffers-api-GtIYIQilz5), [Postiz source/license](https://github.com/gitroomhq/postiz-app), [Mixpost source/license](https://github.com/inovector/mixpost).

For a deeper feasibility comparison of **zero-subscription** publishing paths, native Meta scheduling, Activepieces and Social SDK, see [RES-0003](RES-0003-free-publishing-paths.md). For Muse-specific capabilities and gaps see [RES-0004](RES-0004-muse-agent-fit.md). Vendor prices belong in the [cost model](RES-0002-cost-model.md).

## Findings

- Buffer documents scheduling text/image posts for Facebook channels, but this is **not** evidence of actual publishing permissions for the owner's Pages.
- Saying 'Facebook API cannot publish any Page posts' is too broad; permissions, app review and operation eligibility are the critical unknowns.
- The differentiated value is a *content studio*: one idea -> tailored variants by Page -> human review -> provider-independent delivery; not another general scheduler.
- Muse/browser agents may help with ideation but are unverified for reliable unattended posting to all ten Pages.
- Reuse architecture/ideas only within license terms; do not copy proprietary components from competitors.

## Experiments before selection

1. Obtain explicit access to one controlled test Page and validate permitted connections.
2. **First**, test native scheduled text and photo posts with the authorized **Meta Pages API**, record remote IDs and actual published state.
3. **Only if necessary**, test Buffer as a fallback; compare Social SDK/Activepieces direct API wrappers without assuming they solve Meta permission review.
4. Evaluate Postiz/Mixpost deployment RAM, CPU, licensing and operations on a cheap VPS.
5. Exercise timezone, disconnect, token expiry, 429 limits, ambiguous timeouts and safe reconciliation.
6. Compare total operating cost using [cost model](RES-0002-cost-model.md); then formalize provider decision.

Research findings are not accepted architecture; see [candidate proposal](../proposals/PROP-0001-local-first-mvp.md).
