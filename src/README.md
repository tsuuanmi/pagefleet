# Source ownership

The local-first PageFleet application lives here. The server is the security boundary: it owns the SQLite connection, authorizations, AI credentials, Graph API calls and media files. The browser never receives secrets.

- [server.mjs](server.mjs): HTTP routes, host/origin/auth limits, uploads and views.
- [cli.mjs](cli.mjs): CLI flags, safe bind and Host validation.
- [demo.mjs](demo.mjs): isolated sample workspace with mock-only workflows.
- [db.mjs](db.mjs): schema, ten demonstration Page profiles, persistence and deliveries.
- [logic.mjs](logic.mjs): validation and editorial rules.
- [import.mjs](import.mjs): bounded CSV and XLSX parsing.
- [providers.mjs](providers.mjs): AI provider adapters and the mock publisher.
- [meta.mjs](meta.mjs): Facebook Login, encrypted Page tokens and Meta-native scheduled publishing ([ADR-0001](../docs/decisions/ADR-0001-oauth-page-connection.md)).
- [public/README.md](public/README.md): UI source ownership.

No external JavaScript dependencies are required: Node.js 22.13+ is the runtime. Source packages and local browser resources have owning READMEs. This is **not** a production-verified Facebook integration; real Meta publishing requires Connect Facebook on a Page you control and a successful explicit trial.

Governing docs: [architecture](../docs/architecture/mvp.md), [ADR-0001](../docs/decisions/ADR-0001-oauth-page-connection.md), [requirements](../docs/requirements/product.md), [research](../docs/research/README.md).
