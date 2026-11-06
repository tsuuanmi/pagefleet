---
type: requirement
status: draft
summary: Draft desired outcomes for an AI-assisted workflow for ten Facebook Pages.
reviewed: 2026-11-06
---

# Product requirements (draft)

Nothing below has been implemented or accepted as an architectural design. Confirm with the operator before beginning implementation.

## Authoring and review

- **REQ-0001:** Manage 10 authorized Facebook Pages: 7 in a shared subject area and 3 in other areas, with independent Page profiles. **Verify:** select and configure ten distinct Page voices/audiences.
- **REQ-0002:** Accept Excel/CSV content ideas or manual entry with title, context/prompts, media, target Pages and optional schedule. **Verify:** import row-level feedback and equivalent manual records.
- **REQ-0003:** Support Claude and OpenAI through replaceable text-generation adapters. **Verify:** switch provider, record model and usage per request.
- **REQ-0004:** Generate independent, editable variants appropriate to each selected Page's audience, style, content angle and CTA; no naive duplicate posting. **Verify:** one idea produces different editable variants across seven Pages.
- **REQ-0005:** Preview, edit, approve/reject and schedule variants. **Verify:** unapproved or stale revisions cannot be published.
- **REQ-0006:** Accept image uploads/reuse and validate media before publishing. **Verify:** unsafe/invalid file types and sizes cause visible errors.

## Publishing, reliability and deployment

- **REQ-0007:** Use authorized publishing provider APIs with access limited to Pages under operator control. **Verify:** text+image on a consented test Page, with external post ID/URL and observed status.
- **REQ-0008:** Manage per-Page scheduled deliveries with explicit timezone, status, cancellation, retries and unknown-outcome reconciliation. **Verify:** restart worker without losing jobs or duplicating posts.
- **REQ-0009:** Trace an idea through variant revision, human approval and publish attempt. **Verify:** audit timestamps, target Page, result and error.
- **REQ-0010:** Support localhost development and configuration-driven move to a persistent, authenticated VPS worker. **Verify:** same business flow in both.

## Economics and safety

- **REQ-0011:** Estimate and measure monthly cost, including AI token usage, publisher subscription, compute, storage and backups. **Verify:** breakdown by source/provider, per-Page workload and budget.
- **REQ-0012:** Set limits/approval gates for paid bulk operations, and treat remote unknown success as non-retriable until reconciled. **Verify:** cost caps block excess calls and publish attempts cannot blindly double-send.
- **REQ-0013:** Keep all API keys/Page tokens on server, secure media and production access. **Verify:** credentials are not in client bundles/logs.

## Explicit MVP exclusions

No automatic image/video generation, Reels, complex analytics, auto-comments, general multi-tenant SaaS or browser-based login/publishing workarounds.

## Information still to confirm

Actual Page admin roles and permissions; post frequency; posting languages; Page-specific voice and media specifications; number of editors and approvers; subscription budget; retention needs; and whether 24/7 availability is required.
