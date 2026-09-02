# Database Schema

Defined in `backend/reset.sql`, which drops and recreates the
`request_basket` database from scratch — run it any time you want a clean
local database (see the root README's setup steps).

## `sessions`

Backs `express-session` via `connect-pg-simple` (configured in
`backend/index.js` as the session store, table name `sessions`). Not
managed by application code directly — the session middleware reads and
writes it on every request.

| Column   | Type           | Notes                          |
| -------- | -------------- | ------------------------------- |
| `sid`    | `VARCHAR`      | Primary key. The session ID (also the value of the session cookie). |
| `sess`   | `JSON`         | Serialized session data.        |
| `expire` | `TIMESTAMP(6)` | When this session expires.      |

## `baskets`

A basket is a named container for captured requests, created under
whichever session created it.

| Column         | Type          | Notes                                                   |
| -------------- | ------------- | -------------------------------------------------------- |
| `id`           | `SERIAL`      | Primary key.                                              |
| `session_id`   | `VARCHAR`     | References `sessions.sid`, `ON DELETE CASCADE`.           |
| `total_count`  | `INT`         | Defaults to `0`. **Currently unused** — nothing reads or writes it yet. |
| `name`         | `VARCHAR(20)` | Unique, not null. The human-facing basket name used in URLs (e.g. `/web/a1b2c3d`) and as the webhook path (`POST /a1b2c3d`). |

## `http_requests`

One row per captured webhook request.

| Column         | Type          | Notes                                                   |
| -------------- | ------------- | -------------------------------------------------------- |
| `id`           | `SERIAL`      | Primary key.                                              |
| `basket_id`    | `INT`         | References `baskets.id`, `ON DELETE CASCADE`.              |
| `method`       | `VARCHAR(10)` | HTTP method of the captured request (`GET`, `POST`, etc.). |
| `headers`      | `JSONB`       | The captured request's headers.                          |
| `body`         | `JSONB`       | The captured request's parsed JSON body.                 |
| `received_at`  | `TIMESTAMPTZ` | Defaults to `NOW()` — when the webhook was received.      |

## Relationships

```
sessions (1) ──< (many) baskets (1) ──< (many) http_requests
```

Deleting a session cascades to its baskets, and deleting a basket
cascades to its captured requests.
