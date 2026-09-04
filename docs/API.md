# API Reference

Base URL in development: `http://localhost:3000` (the frontend reaches
these through Vite's `/api` proxy — see `frontend/vite.config.js`).

All responses are JSON. There is no login or session system — "ownership"
of a basket is proven with a bearer access token instead. See
[Authentication](#authentication) below.

## Authentication

`POST /api/baskets/:name` (creating a basket) returns a one-time access
`token` in its response. Send it back on any endpoint marked 🔒 below as:

```
Authorization: Bearer <token>
```

The server only ever stores a SHA-256 hash of the token (the `token_hash`
column on `baskets` — see [`SCHEMA.md`](SCHEMA.md)) and compares it with a
constant-time check (`crypto.timingSafeEqual`). The raw token itself is
never persisted, so it can't be recovered if lost — see the root README's
[Known issues](../README.md#known-issues--gotchas).

A 🔒 endpoint returns `404` if the named basket doesn't exist at all, or
`403` with `{ "message": "Invalid or missing basket token" }` if it exists
but the token is missing or wrong.

## Baskets

### `GET /api/new-basket`

Generates a random, currently-unused basket name (does **not** create the
basket — call `POST /api/baskets/:name` to actually create it).

**Response** `200`
```json
"a1b2c3d"
```

### `POST /api/baskets/:name`

Creates a new basket with the given name. No token is required to create
one — any unused name can be claimed by anyone.

**Response**
- `200` — the created basket row, plus the one-time access token:
  ```json
  {
    "id": 3,
    "name": "a1b2c3d",
    "token_hash": "9f2c...  (sha256 hex)",
    "total_count": 0,
    "expires_at": "2026-10-04T07:21:29.312Z",
    "token": "the-raw-access-token-save-this-now"
  }
  ```
  `token` is shown only in this response — the frontend saves it to
  `localStorage` immediately and shows it once more via a popup for the
  user to copy elsewhere. It cannot be retrieved again afterwards.
- `409` — `{ "message": "Basket already exists" }` if the name is taken.

### `GET /api/baskets/:name` 🔒

Fetches a single basket's metadata.

**Response** `200`
```json
{ "id": 3, "name": "a1b2c3d", "expires_at": "2026-10-04T07:21:29.312Z" }
```

> Previously this route had a bug where a missing `await` caused it to
> return a serialized `Promise` instead of the basket data. That's fixed —
> the route now `await`s the lookup, and additionally requires the access
> token.

### ~~`GET /api/baskets`~~ (removed)

Used to list every basket tied to the caller's session cookie. The
session-cookie ownership model is gone entirely; this route is now
commented out in `backend/index.js`. The frontend no longer asks the
server which baskets belong to the current visitor — it reads its basket
list straight out of `localStorage` (see
`frontend/src/communications/communications.jsx`).

### `DELETE /api/baskets/:name` 🔒

Deletes a basket. Its captured requests are removed too, via
`ON DELETE CASCADE`.

**Response**
- `204` — No Content, on success.
- `403` / `404` — as described in [Authentication](#authentication).

## Requests (webhook capture)

### `ALL /basket/:name` and `ALL /basket/:name/*path`

The actual webhook endpoint — point any HTTP client at
`http://localhost:3000/basket/<basketName>` (or any path underneath it)
and whatever it sends is stored and broadcast live to the frontend over
Socket.io. **Any HTTP method is accepted**, not just `POST`.

The request body is read as raw text regardless of `Content-Type`, then
`JSON.parse`d; if that fails, the raw text is stored as-is.

**Response**
- `200` — `{ "message": "Webhook received" }`
- `404` — `{ "message": "Basket not found" }` if no basket with that name
  exists.

**Side effects:**
- Inserted into `http_requests` (method, headers, parsed body, `path` —
  the part of the URL after `/basket/<name>`, empty string for the bare
  endpoint — and a server-assigned `received_at`).
- Best-effort mirrored to a MongoDB `raw_requests` collection as raw HTTP
  text (`backend/db/mongo.js`, the `recordToBasket` middleware). This runs
  *before* the basket-exists check, so a raw copy is written to Mongo even
  for requests aimed at a basket that doesn't exist. A Mongo write failure
  is logged and otherwise ignored — it never blocks the webhook response.
- Emits a `webhook-update` Socket.io event: `{ "basketName": "<name>" }`.
  Note this is currently broadcast to *all* connected clients, not just
  ones viewing this basket (see root README's known issues) — the
  frontend filters by `basketName` on receipt and re-fetches the request
  list rather than trusting an embedded payload.

### `GET /api/baskets/:name/requests` 🔒

Lists every captured request for a basket (method, headers, body, path,
received timestamp), newest first.

**Response** `200`
```json
[
  {
    "id": 1,
    "basket_id": 3,
    "method": "POST",
    "headers": { "...": "..." },
    "body": { "...": "..." },
    "path": "",
    "received_at": "2026-08-20T12:34:56.000Z"
  }
]
```

### ~~`DELETE .../requests`~~ (removed)

There is currently no way to delete individual captured requests, or
clear a basket's request list, via the API — only deleting the whole
basket (which cascades) removes them.

## Socket.io events

Connect to the backend's Socket.io server at `http://localhost:3000`
(see `frontend/src/components/BasketPage.jsx` and `HomePage.jsx`).

| Event            | Direction       | Payload                        | Notes |
| ----------------- | --------------- | ------------------------------- | ----- |
| `webhook-update`  | server → client | `{ "basketName": "<name>" }`   | Broadcast to every connected client, not scoped to one basket — a client re-fetches the request list if `basketName` matches what it's viewing. |
| `cron-delete`     | server → client | array of deleted basket rows, e.g. `[{ "id": 3, "name": "a1b2c3d", ... }]` | Emitted by the every-20-seconds expiry sweep. Both the home page and any open basket page listen for this; a basket page redirects to `/web` if its own basket is among the deleted ones. |
