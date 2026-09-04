# Database Schema

Defined in `backend/reset.sql`, which drops and recreates the
`request_basket` database from scratch — run it any time you want a clean
local database (see the root README's setup steps).

There is no session or user table — the app has no login system. A
basket's owner proves ownership with a bearer access token compared
against `baskets.token_hash`; see the root README's
["How it works"](../README.md#how-it-works) and
[`docs/API.md`](API.md#authentication).

## `baskets`

A basket is a named container for captured requests.

| Column         | Type            | Notes                                                   |
| -------------- | --------------- | -------------------------------------------------------- |
| `id`           | `SERIAL`        | Primary key.                                              |
| `name`         | `VARCHAR(20)`   | Unique, not null. The human-facing basket name used in URLs (e.g. `/web/a1b2c3d`) and as the webhook path (`/basket/a1b2c3d`). |
| `token_hash`   | `CHAR(64)`      | Not null. SHA-256 hex digest of the basket's one-time access token. The raw token is never stored — only this hash, checked with a constant-time comparison. |
| `total_count`  | `INT`           | Defaults to `0`. **Currently unused** — nothing reads or writes it yet. |
| `expires_at`   | `TIMESTAMPTZ`   | Not null. Set to 30 days after creation. A cron job in `backend/index.js` deletes any basket whose `expires_at` has passed, every 20 seconds, and broadcasts the deletion over Socket.io (`cron-delete`). |

## `http_requests`

One row per captured webhook request.

| Column         | Type          | Notes                                                   |
| -------------- | ------------- | -------------------------------------------------------- |
| `id`           | `SERIAL`      | Primary key.                                              |
| `basket_id`    | `INT`         | References `baskets.id`, `ON DELETE CASCADE`.              |
| `method`       | `VARCHAR(10)` | HTTP method of the captured request (`GET`, `POST`, etc. — any method is accepted). |
| `headers`      | `JSONB`       | The captured request's headers.                          |
| `body`         | `JSONB`       | The captured request's body, JSON-parsed where possible (otherwise the raw text). |
| `path`         | `TEXT`        | The URL path after `/basket/<name>` — e.g. a request to `/basket/a1b2c3d/foo/bar` stores `/foo/bar` (empty string for the bare basket endpoint). |
| `received_at`  | `TIMESTAMPTZ` | Defaults to `NOW()` — when the webhook was received.      |

## Relationships

```
baskets (1) ──< (many) http_requests
```

Deleting a basket cascades to its captured requests.

## MongoDB (separate from the schema above)

The backend also mirrors every webhook attempt — including ones aimed at
a basket that doesn't exist — into a MongoDB `raw_requests` collection as
a best-effort, schema-less audit log (`backend/db/mongo.js`). It's
entirely independent of Postgres: no foreign keys, no relationship to
`baskets`/`http_requests`, and nothing currently reads it back through the
API. Each document looks roughly like:

```json
{
  "basket": "a1b2c3d",
  "raw": "POST /basket/a1b2c3d HTTP/1.1\r\nHost: ...\r\n\r\n{\"hello\":\"world\"}",
  "method": "POST",
  "url": "/basket/a1b2c3d",
  "receivedAt": "2026-08-20T12:34:56.000Z"
}
```
