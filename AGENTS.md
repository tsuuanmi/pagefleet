# PageFleet agent instructions

1. Read [README](README.md), [docs router](docs/README.md), [governance profile](docs/governance/documentation.md), and the relevant canonical document.
2. Use `python3 tools/docs.py trace <path-or-ID>` when following an existing document. When code is present, read its nearest owning README, code and tests.
3. Research/proposals are **not** implementation, accepted architecture, or deployed truth. Never state unverified platform capabilities as fact.
4. Maintain one canonical home for each fact; link instead of duplicating. Do not hand-edit generated blocks or reuse retired IDs. Update documentation together with behavior.
5. Use authorized publishing APIs and official OAuth. No unauthorized account automation, credential sharing or evasion of platform controls.
6. Protect secrets server-side; require human approval; never blindly retry a publish with unknown remote outcome.
7. Optimize total cost (hosting + LLM + media + integrations + operations) without compromising reliability. Source code does not exist yet.
8. When source roots are added, update the local docs profile and add ownership README files.

Checks: `python3 tools/docs.py check`; `python3 tools/docs.py sync --check`; when paths are covered, `python3 tools/docs.py impact <base-ref>`. Do not claim checks passed without running them.
