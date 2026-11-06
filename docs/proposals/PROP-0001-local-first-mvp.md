---
type: proposal
id: PROP-0001
status: proposed
created: 2026-11-06
summary: Local web app first, provider adapter and low-cost migration to VPS.
evidence: [RES-0001, RES-0002]
---

# Local-first PageFleet MVP

**Status: proposal only, unimplemented.** Desired outcomes are in [requirements](../requirements/product.md), external evidence in [platform research](../research/RES-0001-publishing-alternatives.md) and [cost model](../research/RES-0002-cost-model.md).

## Staged approach

0. **Publishing feasibility gate:** one explicitly authorized Facebook test Page; validate media post, scheduling, retrieval, quota, token expiry and ambiguous errors with Buffer, compare official Meta eligibility. Avoid any workaround to access restrictions.
1. **Local website:** Excel/CSV/manual input, 10 Page Profiles, Claude/GPT adapters, one idea -> independent Page-specific versions, preview/edit/approve, calendar and Mock Publisher.
2. **Real pilot:** start with one/two Page connections, approved schedules and audit trail; expand to ten only after verified delivery and recovery.
3. **VPS:** same app/worker in Docker Compose, HTTPS/domain, access control, persistent DB/media, offsite backups, health checks and restore drills.

## Candidate boundaries (not selected)

- UI: idea intake, Page Profiles, variant editor, approval, calendar and cost reporting.
- Content core: `ContentIdea -> PostVariant(PageProfile) -> Approval`; approved revision is immutable for publishing.
- Publishing: `Publisher` interface, separate `MockPublisher`, `BufferPublisher` and optional `MetaPublisher`; a delivery maps to exactly one destination and stores external IDs.
- Worker: durable scheduled jobs, idempotency keys, retry/backoff, rate limits and uncertain-outcome reconciliation.
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

Buffer paid API vs direct Meta vs a self-hosted publisher; media types; operator and approval roles; monthly budget; volume and AI model defaults; backup cadence; VPS region; license exposure when adapting third-party source.

## Acceptance/promotion

After publishing proof and cost evaluation, create an accepted decision and an architecture document. This proposal must not be cited as current implementation until that point.
