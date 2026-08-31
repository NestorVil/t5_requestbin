# requestbin-backend

A RequestBin-style backend: create a "basket," get a URL, send it any HTTP
request, and inspect what arrived. No login — an anonymous, cookie-based
session ties baskets to the browser that created them.

## Storage design

- **PostgreSQL** — the primary data store. Sessions, baskets, and fully
  parsed/structured request data (method, path, headers, content-type, body)
  all live here and are queryable.
- **MongoDB** — a backup-only copy of the complete raw HTTP text for each
  request (request line + headers + body, reconstructed from
  `req.rawHeaders` to preserve original order/casing). Not read during
  normal app operation — only useful for recovery if something goes wrong
  writing to Postgres.
- Write order matters: Mongo is written **first**, since the Postgres
  `requests` row stores a pointer (`mongo_raw_id`) to that document.

## Sessions (no accounts)

First request to `/api/baskets/*` with no valid session cookie gets a new
64-character random session id, stored in `sessions` and set as an
`httpOnly`, `sameSite=lax` cookie (also `secure` when `NODE_ENV=production`),
expiring after 30 days. Losing this cookie means losing access to whatever
baskets were tied to it — no recovery mechanism, by design. There's no
access control on reading a basket's data — knowing its name is enough,
same as sending it a request.

Capture requests to `/basket/:name` (the ones third parties send) never
touch sessions at all.

## Real-time updates (WebSockets)

Clients can connect to `ws://<host>/api/baskets/:name/stream` with a
WebSocket client to receive newly captured requests the instant they
arrive, as JSON text frames — no polling needed. This is handled outside
Express's normal routing (see `services/wsService.js`): the raw HTTP
server listens for the `'upgrade'` event directly, validates the basket
exists, and only then completes the WebSocket handshake.

## Sub-paths

A basket's capture endpoint isn't limited to its exact URL — requests to
`/basket/:name/anything/else` are captured too, with `/anything/else`
stored in `requests.path`. A request to the bare `/basket/:name` root
stores `path` as `/`.

## Cleanup

A basket is automatically deleted (cascading to its requests) once it's
been inactive for longer than the configured expiration window (7 days
by default — see `config/env.js`), measured from its most recent
request's `received_at`, or its own `created_at` if it's never received
one. This runs as an in-process job (`services/cleanupService.js`) on a
`setInterval`, checked hourly by default, plus once immediately at
startup.

Baskets can also be deleted manually at any time via
`DELETE /api/baskets/:name` — this removes the whole basket and all of
its requests; there's no endpoint for deleting individual requests.

## Pagination

`GET /api/baskets/:name/requests` accepts `?limit=` (default 50, capped at
200) and `?offset=` (default 0) query parameters, and always orders
results newest-first. The response includes `totalCount` — the total
number of requests for that basket, computed in the same query via
`COUNT(*) OVER()` rather than a separate query or a denormalized counter
column — so the frontend can compute things like "page 2 of 8" without an
extra round-trip:

```json
{
  "requests": [ /* up to `limit` request objects */ ],
  "totalCount": 143,
  "limit": 20,
  "offset": 20
}
```

## Error handling & robustness

- **Async errors don't hang anymore.** Every route is wrapped with
  `middleware/asyncHandler.js`, which forwards a rejected Promise to
  Express's error pipeline via `next(err)` — without this, Express 4
  doesn't catch async errors on its own, and a client's request would
  otherwise just hang indefinitely with no response.
- **Centralized error responses** (`middleware/errorHandler.js`, mounted
  last in `server.js`) log the full error server-side but only ever send
  the client a clean, generic message — no stack traces or internal file
  paths, which Express's own default error handler would otherwise leak.
- **Pagination is validated** (`utils/pagination.js`) — `limit`/`offset`
  must be non-negative integers or the request gets a `400`, rather than
  reaching Postgres and erroring (or, for `limit=0` specifically, being
  silently overridden to the default).
- **Capture body size is explicit** (5MB by default, see
  `config/env.js`) rather than relying on Express's much smaller 100KB
  default, which real-world webhook payloads can easily exceed.

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and adjust if your local Mongo/Postgres
   aren't on the defaults:
   ```
   cp .env.example .env
   ```
3. Make sure a Postgres database matching `PG_DATABASE` (defaults to
   `requestbin`) already exists, then run the migration to create its
   tables:
   ```
   npm run migrate
   ```
   **This drops and recreates `requests`, `baskets`, and `sessions` every
   time it runs** — there's no incremental migration system, so any
   existing data is wiped whenever the schema changes. That's an
   intentional tradeoff for this project (see the comment in
   `src/db/migrate.js`), fine for early development, worth revisiting if
   this ever needs to preserve real data across schema changes.
4. Make sure MongoDB is running/reachable (no schema/setup needed — it
   creates the `raw_requests` collection on first insert).
5. Start the server:
   ```
   npm run dev
   ```

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/baskets` | Create a basket. Body: `{ "name": "abc12345" }`. 409 if taken. |
| GET | `/api/baskets` | List baskets belonging to the current session. |
| DELETE | `/api/baskets/:name` | Delete a basket and all of its requests. |
| ALL | `/basket/:name` and `/basket/:name/*` | Send any request here to capture it. |
| GET | `/api/baskets/:name/requests` | List captured requests (paginated, newest first). |
| WS | `/api/baskets/:name/stream` | WebSocket stream of newly captured requests. |

## Trying it out

```bash
# 1. Create a basket (-c saves the session cookie for subsequent calls)
curl -c cookies.txt -X POST localhost:3000/api/baskets \
  -H 'Content-Type: application/json' -d '{"name":"abc12345"}'

# 2. Send it something (root, or a sub-path)
curl -X POST localhost:3000/basket/abc12345 -d '{"hello":"world"}'
curl -X POST localhost:3000/basket/abc12345/payment/completed -d '{"ok":true}'

# 3. See what arrived
curl localhost:3000/api/baskets/abc12345/requests

# 4. Watch live (needs a WebSocket-capable client, not plain curl) — e.g.
#    in a browser console:
#    const ws = new WebSocket('ws://localhost:3000/api/baskets/abc12345/stream');
#    ws.onmessage = (e) => console.log(JSON.parse(e.data));

# 5. List your baskets (-b sends the saved session cookie back)
curl -b cookies.txt localhost:3000/api/baskets

# 6. Delete a basket
curl -b cookies.txt -X DELETE localhost:3000/api/baskets/abc12345
```

## Database schema

```sql
sessions
  id            TEXT PRIMARY KEY CHECK (char_length(id) = 64)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()

baskets
  id            SERIAL PRIMARY KEY
  name          TEXT UNIQUE NOT NULL CHECK (name ~ '^[a-z0-9]{1,32}$')
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()

requests
  id            SERIAL PRIMARY KEY
  basket_id     INT NOT NULL REFERENCES baskets(id) ON DELETE CASCADE
  method        TEXT NOT NULL CHECK (method IN ('GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'))
  path          TEXT NOT NULL  -- e.g. "/" or "/foo/bar"
  headers       JSONB NOT NULL
  content_type  TEXT
  body          TEXT  -- nullable: NULL = no body sent, '' = empty body sent
  mongo_raw_id  TEXT NOT NULL
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now()
```

Deleting a session cascades to delete its baskets, which cascades to
delete their requests.

## Project layout

```
src/
  config/env.js         # env vars, session cookie config, cleanup thresholds
  db/
    postgres.js         # pg Pool
    mongo.js             # MongoClient connection
    migrate.js            # runs the SQL migration
    migrations/001_init.sql
  middleware/session.js   # custom cookie-based session handling
  services/
    sessionService.js     # create/find/touch sessions (Postgres)
    basketService.js       # create/check/list/delete baskets (Postgres)
    requestService.js       # capture flow: Mongo write + Postgres write + WS broadcast
    wsService.js              # WebSocket upgrade handling + per-basket broadcast
    cleanupService.js          # scheduled deletion of inactive baskets
  utils/buildRawHttpText.js # reconstructs raw HTTP text from req.rawHeaders
  routes/
    baskets.js              # /api/baskets/* — management + read API (session-aware)
    capture.js                # /basket/:name[/*] — the catch-all capture endpoint
  server.js                   # wires it all together (raw http.Server for WS support)
```

## Known limitations (by design, per project decisions)

- No binary body support — bodies are assumed to always be plain text.
- No access control — anyone who knows a basket's name can view or send
  data to it.
- No way to delete individual requests, only whole baskets.
- CORS is configured but `ALLOWED_ORIGIN` needs to match your actual
  frontend dev server's URL once it exists (see `.env.example`). Note
  also that the session cookie's `sameSite=lax` setting won't be sent on
  cross-origin `fetch`/XHR calls at all (only on top-level navigations) —
  if the frontend ends up on a different origin than this API during
  development, a dev-server proxy (routing frontend API calls through the
  same origin) is the more reliable fix than CORS alone.
