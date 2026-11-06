# Browser UI ownership

[app.js](app.js) renders only escaped server data, binds controls without inline handlers, and invokes JSON endpoints through same-origin requests with a custom CSRF request header. [index.html](index.html) and [style.css](style.css) are static. Do not put provider credentials or tokens here.

The page is a single-operator local MVP, not a multi-user system. Authentication is required whenever the server binds beyond loopback. For the API contract, see the [architecture](../../docs/architecture/mvp.md).
