---
type: proposal
id: PROP-0001
status: proposed
created: 2026-11-06
summary: Local web app first, provider adapter and low-cost migration to VPS.
evidence: [RES-0001, RES-0002, RES-0003, RES-0004]
---

# Local-first PageFleet MVP

**Status: proposal only, unimplemented.** Desired outcomes are in [requirements](../requirements/product.md), external evidence in [platform research](../research/RES-0001-publishing-alternatives.md) and [cost model](../research/RES-0002-cost-model.md).

## Staged approach

0. **Publishing feasibility gate:** prioritize **direct Meta API with native scheduling**, using one explicitly authorized Page. Verify permission access, text/photo schedule, remote ID, retrieval, token lifecycle and ambiguous errors. Compare Social SDK as a thin implementation aid. Use Buffer only as a paid fallback when direct access is blocked, unreliable or too costly to maintain. Avoid any workaround to access restrictions.
1. **Local website:** Excel/CSV/manual input, 10 Page Profiles, Claude/GPT adapters, one idea -> independent Page-specific versions, preview/edit/approve, calendar and Mock Publisher.
2. **Real local pilot:** submit approved posts into **Meta-native scheduling** while the workstation is running; test that the post publishes after the workstation shuts down. Start with one/two Page connections and expand only after verified delivery and recovery. Keep a read-back/reconciliation step for the next session and a visible schedule horizon.
3. **Optional VPS upgrade:** only when unattended *submission of new posts*, longer-term queue refill, notifications, remote collaboration or continuous reconciliation justify the cost. Run the same app/worker via Docker Compose, HTTPS/domain, access control, persistent DB/media, offsite backups, health checks and restore drills.

## Candidate boundaries (not selected)

- UI: idea intake, Page Profiles, variant editor, approval, calendar and cost reporting.
- Content core: `ContentIdea -> PostVariant(PageProfile) -> Approval`; approved revision is immutable for publishing.
- Publishing: `Publisher` interface with `MockPublisher` and a **preferred direct `MetaPublisher`** (consider MIT Social SDK); `BufferPublisher` remains a paid fallback. A delivery maps to exactly one destination and stores external IDs and native scheduled timestamps.
- Worker: **not required to fire a post already accepted by Meta's native schedule**. Still use persistent delivery/approval records, explicit idempotency and safe reconciliation; introduce a continuously running queue later for unsent future drafts or multi-platform support.
- AI: replaceable Claude/OpenAI providers, usage metering, caps, budget default model and opt-in expensive generation.
- Media: validation, storage and provider-compatible attachment references.

Illustrative stack, **not a commitment**: Next.js/TypeScript, PostgreSQL, Drizzle, PostgreSQL-backed queue, Excel parser, local media then S3-compatible media when justified, Docker Compose + Caddy. Avoid Temporal/Kubernetes/microservices for a ten-Page workload unless real measurements justify them.

## Non-negotiable safety/reliability invariants to validate

- Nothing publishes without approval of the *exact current revision* and authorized Page scope.
- Do not blindly retry an unknown remote outcome. Reconcile remote state before another attempt; log all attempts.
- API tokens and provider keys never reach browser bundles/logs; production UI and worker are authenticated.
- Scheduled jobs survive worker restart; times are timezone-safe and statuses honest.
- Track expenses and stop paid generation when operator-set budget would be exceeded.
- Content differences must reflect audience, angle and value rather than mechanical paraphrasing.

## Open choices

Exact Meta roles/permissions and whether Standard or Advanced Access applies; Buffer fallback vs direct Meta/native scheduling and MIT Social SDK; media types; operator and approval roles; monthly budget; volume and AI model defaults; backup cadence; VPS region; license exposure when adapting third-party source.

## Acceptance/promotion

After direct native scheduling proof (including offline-at-due-time) and cost evaluation, create an accepted decision and an architecture document. This proposal must not be cited as current implementation until that point.
