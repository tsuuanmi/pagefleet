# Source ownership

The local-first PageFleet application lives here. The server is the security boundary: it owns the SQLite connection, authorizations, AI credentials, Graph API calls and media files. The browser never receives secrets.

- [server.mjs](server.mjs): HTTP routes, host/origin/auth limits, uploads and views.
- [db.mjs](db.mjs): schema, ten demonstration Page profiles, persistence and deliveries.
- [logic.mjs](logic.mjs): validation and editorial rules.
- [import.mjs](import.mjs): bounded CSV and XLSX parsing.
- [providers.mjs](providers.mjs): AI provider adapters and Meta-native scheduled publishing.
- [public/README.md](public/README.md): UI source ownership.

No external JavaScript dependencies are required: Node.js 22.13+ is the runtime. Source packages and local browser resources have owning READMEs. This is **not** a production-verified Facebook integration; real Meta publishing requires authorized Page tokens and a successful explicit trial.

Governing docs: [architecture](../docs/architecture/mvp.md), [requirements](../docs/requirements/product.md), [research](../docs/research/README.md).
