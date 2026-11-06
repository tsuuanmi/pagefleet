---
type: research
id: RES-0002
status: active
date: 2026-11-06
summary: Full cost inventory, dated provider prices, reproducible workload scenarios.
---

# Costs and optimization — research snapshot

Prices checked **2026-11-06**; not purchase quotes. Prices can change, tax/FX may apply, and some plans require annual prepayment. Keep USD and EUR separate until using the actual invoice FX rate.

## Total cost inventory

| Cost | One-time / recurring | What changes it |
|---|---|---|
| Development, integration, API review, QA, security | One-time + maintenance | Engineering hours, provider review, OAuth, ownership and support |
| Publisher subscription | Monthly/annual | Number of connected channels, API quotas, users, approval features |
| LLM text | Usage-based | Input/output/cached tokens, model, length, revisions, calls per post |
| Media | Usage-based | Image generation, processing, uploaded file storage, bandwidth |
| Compute + database + worker | Monthly + setup | Local electricity/uptime or VPS CPU/RAM/disk, persistent DB |
| Domain, public IP, HTTPS, DNS | Annual/monthly | Domain/IPv4 add-on; free certificates may avoid paid TLS |
| Backups and disaster recovery | Monthly + staff | Snapshots, off-site retention, restore tests, storage |
| Email, logs, monitoring | Monthly/usage | Alerts, delivery status, uptime, logs, email provider |
| Compliance and reliability | Staff time + contingency | Access token renewals, policy change, rate limits, incidents |
| Taxes, FX, overages | Variable | Region, payment method, data transfer, vendor plans |

## Verified public price anchors

| Supplier | Price as displayed | Scope and source |
|---|---|---|
| [Buffer](https://buffer.com/pricing) Free | 3 channels maximum | Cannot host all ten Pages; API included with limits |
| [Buffer](https://buffer.com/pricing) Essentials | **USD 5/channel/month**, billed yearly | 10 channels ~ **USD 50/month equivalent, USD 600/year billed** excluding tax |
| [Buffer](https://buffer.com/pricing) Team | **USD 10/channel/month**, billed yearly | 10 channels ~ **USD 100/month equivalent, USD 1,200/year billed** |
| [Hetzner June 2026 price adjustment](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/) CX23 in DE/FI | **EUR 5.49/month** | Excluding VAT and IPv4; must test suitability |
| Same source: CX33 in DE/FI | **EUR 8.49/month** | Excluding VAT and IPv4; not a guaranteed capacity quote |
| [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing) Haiku 5.5 | **USD 0.10/M input + USD 0.50/M output tokens** | Short prompts up to 100k tokens; other tiers apply above that |
| Same source: Sonnet 5.5 | **USD 2/M input + USD 10/M output tokens** | Text token costs only |
| [OpenAI pricing](https://developers.openai.com/api/docs/pricing) | Model-specific input/output/cache rates | Select and record exact model/mode before forecasting |
| [Backblaze B2 pricing](https://help.backblaze.com/hc/en-us/articles/217667478-Understanding-B2-Pricing-Structure) | From **USD 6.95/TB/month** | Storage only; evaluate actual usage and transfer terms |

Buffer's [GraphQL API](https://developers.buffer.com/guides/introduction.html) is included in plans, but usage caps/limits vary. Never model the Free plan as ten usable Pages.

## Cost formulas

Let `P`=Pages, `D`=posts/Page/day, `N=P*D*30` = delivered variants/month. Let `A`=average generation attempts/variant, `I` and `O`=input/output tokens per attempt. Let `rI,rO` be rates in USD per **million** tokens.

**Text LLM/month (USD)** = `N*A*(I*rI + O*rO)/1_000_000`. Add separately caching, image tokens/generation, tool calls, overages, tax and failed attempts if not captured by A.

**Cash operating/month** = publishing plan + compute + storage + backup + domain/12 + text AI + image/media AI + network + alerts/email + tax/FX/contingency, converted to a common currency first.

**Economic/month** = cash operating + ongoing maintenance hours * loaded hourly rate + amortized one-time engineering. A free direct API is not free to operate.

## Example: 10 Pages, 2 posts/Page/day

`N=10*2*30=600` unique variants/month. Assume one attempt each, 2,000 input and 800 output tokens/variant; 1.2M input and 0.48M output. **Text only, illustration not a quoted invoice:**

| Model | Input cost | Output cost | Total/month |
|---|---:|---:|---:|
| Claude Haiku 5.5 | USD 0.12 | USD 0.24 | **USD 0.36** |
| Claude Sonnet 5.5 | USD 2.40 | USD 4.80 | **USD 7.20** |

Three equally sized generation attempts -> about three times these text-only totals. Long context, revision loops, expensive image generation and staff review can dwarf this figure. Measure real token usage before choosing a model.

See [RES-0003](RES-0003-free-publishing-paths.md) for evidence that Meta supports native Page-post scheduling, potentially eliminating the need for a 24/7 scheduler or VPS during a local-first pilot. See [RES-0004](RES-0004-muse-agent-fit.md) for Muse's usage caps/region and human-approval requirement. These are research findings, not proven for the target Pages.

## Scenario comparisons

- **A. Local + Mock Publisher:** no incremental hosting/publisher subscription, but LLM usage, workstation power and staff cost remain; not a real publisher.
- **A2. Local + direct Meta native scheduling:** potentially **USD 0/month in channel subscription and VPS hosting**, if Meta credentials/permissions and native scheduling work for these Pages. Pre-submit approved posts within the supported scheduling window while the laptop is on; Meta publishes them after it shuts down. Still requires operator time, power, AI if used, backup, monitoring on next open, and token/reconnection maintenance; does **not** run future generation/exports or scheduled submission beyond the window while offline.
- **A3. Free Meta Business Suite:** no subscription/VPS; operator must schedule manually, usually post-by-post. Operational labor scales with number of Page variants.
- **B. PageFleet + Buffer Essentials:** roughly USD 50/month equivalent for 10 channels on annual plan, plus AI and hosting if any. Fastest provider-dependent pilot.
- **C. PageFleet on VPS + Buffer:** B plus VPS (e.g. EUR 5.49 or 8.49/month before IPv4/tax) plus backups/domain. Do **not** sum EUR and USD without FX.
- **D. VPS + direct Meta API:** no Buffer channel invoice if access approved; needed only for unattended *future submission*, reconciliation, notifications or long-horizon queue, rather than for Meta-native posts already scheduled. Accept authentication, reliability and engineering work.
- **E. VPS + self-host Postiz/Mixpost:** infrastructure + ongoing maintenance + license constraints; not automatically cheaper than Buffer.

Compare **12-month total cost** including developer time, not only monthly cloud bills. Buffer's USD 50 monthly equivalent corresponds to USD 600 committed annually for ten channels on the cited annual Essentials rate.

## Break-even test versus Buffer subscription

Using the indicative **USD 50/month equivalent** Essentials plan, saving Buffer subscription is financially justified only if additional direct-API engineering/support work, hosting and expected downtime costs remain below that benefit. For example, **3 hours of extra monthly maintenance at USD 20/hour = USD 60/month** in opportunity cost, exceeding the USD 50 monthly-equivalent subscription saving even if the cash invoice is zero. This is a scenario, not a staff-rate claim. Compare **12-month** TCO, and account for Buffer's annual billing commitment versus no recurring publisher subscription.

Other no-provider-fee generation paths: [Ollama local models](https://ollama.com/) (machine CPU/GPU, electricity and quality trade-offs), [Gemini API free tier](https://ai.google.dev/gemini-api/docs/pricing) (model/region quotas and possible data-use conditions), [Groq free tier limits](https://console.groq.com/docs/rate-limits). Do not treat free quotas as guaranteed production capacity. Claude/OpenAI remain paid fallback options.

## Suggested optimization controls (unimplemented)

1. Per-Page and account-level spend limits; report tokens/models, paid calls, attempts and projected month-end costs.
2. Cheap default LLM, premium escalation only when needed; batch and cache common context where allowed.
3. Approval for bulk generation and publishing; avoid generating for Pages not selected.
4. Reuse user-uploaded media and deduplicate/compress; skip paid image generation in MVP.
5. Start with local mock and a one-Page integration test; buy 10-channel subscription only after passing gate.
6. Small VPS + one database/worker before managed clusters/complex orchestration, but retain independent backups.
7. Include recurring operator review, monitoring, access-token expiry and incident work in TCO.

## Missing inputs for a real budget

Page roles, desired posts/day, % shared ideas, average editing attempts, generated images vs uploads, human approvals and paid users, VPS region/IPv4 needs, data retention, monthly cash ceiling and hourly maintenance cost.
