# Test ownership

Tests cover PageFleet's content revision/approval state machine, interruption-safe delivery reservation, scheduling and image validation, CSV/XLSX import, LAN CLI/binding policies, isolated demo seeds and the local HTTP workflow. No tests make real Meta or paid AI calls. Tests run offline on Node 22.13+.

Governing docs: [MVP architecture](../docs/architecture/mvp.md), [requirements](../docs/requirements/product.md).

`live-schedule.mjs` is **not** run by `npm test`: it schedules real mock posts (text, one image, three numbered images) on every Page linked to a connected Facebook Page, 5 minutes apart, to verify Meta-native scheduling (REQ-0007). It dry-runs unless given `--yes`, and never retries a failed submission.
