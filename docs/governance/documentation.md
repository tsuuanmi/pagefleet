---
level: 1
areas: [governance=governance, requirements=requirement, decisions=decision, research=research, proposals=proposal]
id-prefixes: [decision=ADR, research=RES, proposal=PROP]
source-roots: []
forbidden-names: [archive, archives, deprecated, history, legacy, old, temp, temporary]
ledger: governance/retired.md
reachability-depth: 3
review-days: 365
max-lines: 500
reviewed: 2026-11-07
---

# PageFleet documentation profile

Adopts the [portable standard](documentation-architecture.md). This is PageFleet's **own profile**, not System's product assumptions.

## Authority

- [Requirements](../requirements/README.md) state desired outcomes. They are draft and **not evidence of implementation**.
- [Decisions](../decisions/README.md) record accepted, hard-to-reverse rationale (`ADR-NNNN`).
- [Research](../research/README.md) records uncertain and changing evidence.
- [Proposals](../proposals/README.md) are not accepted implementation or architecture.
- [Governance](README.md) owns documentation rules.

No source roots or accepted architecture yet. Add an area only with real content, and add ownership README files and covers relations when source packages appear.

Decision IDs are `ADR-NNNN`, research `RES-NNNN`, proposals `PROP-NNNN`; never reuse them. Requirement items are defined in one product document. Retirement means promoting surviving truth, fixing links, then appending a ledger row with Git commit:path.

## Conformance and commands

The copied checker supports **Level 1 and limited additional graph/generator checks**; it does **not** claim complete Level 2/3.

- `python3 tools/docs.py check`: structure, metadata, local links, graph reachability.
- `python3 tools/docs.py sync --check`: generated-block drift.
- `python3 tools/docs.py trace <path-or-ID>`: typed relation closure.
- `python3 tools/docs.py impact <base-ref>`: covered source changes.

CI runs these checks. The [agent contract](../../AGENTS.md) routes future coding agents. No generated index is used in the initial docs.
