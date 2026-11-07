---
type: requirement
status: draft
summary: Desired outcomes for an AI-assisted batch workflow that schedules posts on ten Facebook Pages in two Industries.
reviewed: 2026-11-07
decided-by: [ADR-0001]
---

# Product requirements (draft)

These are desired outcomes, not evidence of implementation. Capitalized domain terms (Operator, Page, Page code, Industry, Content idea, Post variant, Batch, Stagger) are defined in the [glossary](../../GLOSSARY.md). Requirements confirmed with the business owner on 2026-11-07.

## Pages and Industries

- **REQ-0001:** Manage up to 10 authorized Pages, each with an operator-assigned **Page code** and exactly one **Industry**. The initial Industries are construction works and granite, owned by the same company. Page codes are short, case-insensitive, letters/digits/hyphen, unique, and immutable once any Content idea uses them; `ALL` is reserved. **Verify:** create Pages with codes in two Industries; reject a duplicate code and a rename of a used code.
- **REQ-0014:** Connect Pages through Facebook Login by the single **Operator**, then choose which of the Operator's Pages to register and assign their code and Industry ([ADR-0001](../decisions/ADR-0001-oauth-page-connection.md)). A Page whose token Meta rejects is shown as **Needs reconnect** and cannot accept new schedules. **Verify:** connect two test Pages; revoke access and observe Needs reconnect.
- **REQ-0015:** Keep per-Industry writing rules as editable data (preferred and avoided terms, content angles, forbidden claims, default CTA, sample posts) so a new Industry needs no code change. Cross-Industry mentions are allowed; project names, specifications, prices and certifications are never invented. **Verify:** add a third Industry from the UI and generate for it.

## Authoring and review

- **REQ-0002:** Accept Content ideas from a spreadsheet (`.xlsx`/`.csv`, English column headers `title`, `ai_prompt`, `tags`, `media`, `publish_at`, `pages`) or from an equivalent web form whose Page picker allows several Pages shown as `CODE – Name`. `pages` holds comma-separated Page codes (`;` also accepted) or `ALL`; an empty cell is a row error. `tags` are hashtags normalized with `#` and de-duplicated, appended verbatim (never invented by AI). `media` lists image filenames in posting order, matched against a folder or ZIP uploaded with the spreadsheet. `publish_at` is Vietnam time (Asia/Ho_Chi_Minh), as an Excel date cell or `dd/mm/yyyy HH:mm`. A downloadable template is provided. **Verify:** import a template file with row-level preview errors for missing media, empty pages, unknown codes and out-of-window times.
- **REQ-0016:** An import is a **Batch**: preview every row as valid or invalid with a reason, let the Operator import only valid rows, and do not create duplicates when the same file is imported again. **Verify:** re-import an identical file and observe no new Content ideas.
- **REQ-0003:** Support Claude and OpenAI through replaceable text-generation adapters plus a free offline template mode, recording model and usage per request. The default model is chosen later by a blind comparison; until then the workflow must run without any paid key. **Verify:** complete a Batch end-to-end with no API key; switch provider and see usage recorded.
- **REQ-0004:** Generate one independent, editable **Post variant** per selected Page, in Vietnamese by default (post language is a Page setting), reflecting the Page's voice and its Industry rules; no naive duplicate posting. **Verify:** one Content idea produces different Post variants across Pages of one Industry.
- **REQ-0005:** Review a whole Batch in one table, edit any Post variant, and approve and schedule all current revisions in one action; unapproved or stale revisions cannot be scheduled. **Verify:** editing after approval blocks scheduling until re-approved.
- **REQ-0006:** Accept image uploads (JPEG/PNG/WebP), up to about ten per post in a fixed order, and validate type and size before publishing. **Verify:** invalid or oversized files produce visible errors; order on Facebook matches the spreadsheet.

## Publishing, reliability and deployment

- **REQ-0007:** Publish only through Meta's authorized APIs to registered Pages, using Meta-native scheduling for text, single-photo and multi-photo posts. **Verify:** on two operator-owned test Pages (unpublished Pages are acceptable), each post type publishes at its time while the workstation is off, with the remote post ID recorded.
- **REQ-0008:** Schedule each Post variant at the Content idea's time plus a **Stagger** (default 20 minutes, 0 allowed) per additional Page; every resulting time must be 11 minutes to 29 days ahead. Keep explicit status, survive restarts, never duplicate posts. **Verify:** a seven-Page row yields times 20 minutes apart; restart does not resubmit.
- **REQ-0017:** Provide a **Needs reconciliation** view for deliveries with unknown or failed outcomes: mark *found on Meta* (with post ID or link) or *not on Meta, allow resubmission*. Cancelling or editing a post already scheduled on Meta is done in Meta Business Suite; PageFleet only records it as cancelled. **Verify:** resolve one unknown delivery each way.
- **REQ-0009:** Trace a Content idea through Post variant revision, approval and publish attempt. **Verify:** audit timestamps, target Page, result and error.
- **REQ-0010:** Run locally first; a configuration-driven move to an authenticated HTTPS VPS is possible later. **Verify:** same business flow in both.

## Economics and safety

- **REQ-0011:** Estimate and measure monthly cost, including AI token usage, compute, storage and backups. **Verify:** breakdown by provider and per-Page workload.
- **REQ-0012:** Bulk AI generation checks the monthly request and spend cap for the whole Batch before starting; remote unknown outcomes are never retried until reconciled. **Verify:** a Batch exceeding the cap is refused before any paid call.
- **REQ-0013:** Keep app secrets, encryption keys and Page tokens server-side only; Page tokens are encrypted at rest ([ADR-0001](../decisions/ADR-0001-oauth-page-connection.md)). **Verify:** tokens appear in no client bundle, log or plaintext database column.

## Interface language

- **REQ-0018:** The web interface and spreadsheet template are in English; published posts follow each Page's language setting (Vietnamese by default). **Verify:** UI strings are English while generated posts are Vietnamese.

## Explicit MVP exclusions

Video (planned for phase 2 after native scheduled-video proof; Meta documents no mixed photo+video post), Reels, automatic image generation, complex analytics, auto-comments, tagging other Pages or people, cancelling/editing remotely scheduled posts through the API, multi-operator roles, general multi-tenant SaaS, and any browser automation or login workaround.

## Information still to confirm

Sample posts per Industry (to be supplied later); Industry assignment of each of the ten Pages; posting frequency; default AI model and monthly budget after comparison; retention and backup cadence; whether 24/7 availability is later required.
