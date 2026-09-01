# API Reference

Base URL in development: `http://localhost:3000` (the frontend reaches
these through Vite's `/api` proxy — see `frontend/vite.config.js`).

All responses are JSON. There is no authentication; "ownership" of a
basket is tracked via the `express-session` cookie set by the backend
(see [`SCHEMA.md`](SCHEMA.md) for the `sessions` table), not a login.

## Baskets

### `GET /api/new-basket`

Generates a random, currently-unused basket name (does **not** create the
basket — call `POST /api/baskets/:name` to actually create it).

**Response** `200`
```json
"a1b2c3d"
```

### `GET /api/baskets`

Lists the baskets created under the current session cookie.

**Response** `200`
```json
[{ "name": "a1b2c3d" }]
```

### `GET /api/baskets/:name`

Fetches a single basket by name.

**Response** `200` — the basket row.

> **Known bug:** the handler is missing an `await` on the lookup, so this
> currently returns a serialized `Promise`, not the basket data. See the
> root README's [Known issues](../README.md#known-issues--gotchas).

### `POST /api/baskets/:name`

Creates a new basket with the given name, tied to the current session
(creating a session row if one doesn't exist yet for this cookie).

**Response**
- `200` — the created basket row.
- `409` — `{ "message": "Basket already exists" }` if the name is taken.

### `DELETE /api/baskets/:name`

**Not implemented yet** (stubbed out in `backend/index.js`).

## Requests (webhook capture)

### `POST /:name`

The actual webhook endpoint — point any HTTP client at
`http://localhost:3000/<basketName>` and whatever it sends (method,
headers, JSON body) is stored and broadcast live to the frontend over
Socket.io.

**Response**
- `200` — `{ "message": "Webhook received" }`
- `404` — `{ "message": "Basket not found" }` if no basket with that name
  exists.

**Side effect:** emits a `webhook-update` Socket.io event with the newly
stored request. Note this is currently broadcast to *all* connected
clients, not just clients viewing this basket (see root README's known
issues).

### `GET /api/baskets/:name/requests`

Lists every captured request for a basket (method, headers, body,
received timestamp), joined from `baskets` + `http_requests`.

**Response** `200`
```json
[
  {
    "id": 1,
    "basket_id": 3,
    "method": "POST",
    "headers": { "...": "..." },
    "body": { "...": "..." },
    "received_at": "2026-08-20T12:34:56.000Z"
  }
]
```

### `DELETE /api/baskets/:name/requests` / `DELETE /api/baskets/:name/requests/:id`

**Not implemented yet** (stubbed out in `backend/index.js`).

## Socket.io events

Connect to the backend's Socket.io server at `http://localhost:3000`
(see `frontend/src/components/BasketPage.jsx`).

| Event            | Direction       | Payload                        | Notes |
| ----------------- | --------------- | ------------------------------- | ----- |
| `webhook-update`  | server → client | the newly-created request row  | Currently broadcast to every connected client rather than scoped to one basket — see known issues. |
