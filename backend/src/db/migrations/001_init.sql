-- Run this once against your local Postgres database, e.g.:
--   npm run migrate

-- Anonymous, cookie-based sessions (no login/accounts).
-- id is app-generated (crypto.randomBytes(32).toString('hex') -> 64 hex chars),
-- not a database default, since the value must exist before the session
-- cookie is set on the response.
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY CHECK (char_length(id) = 64),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A basket is a named capture target, reachable at /basket/:name.
-- name is user-facing and validated to lowercase alphanumeric, 1-32 chars,
-- both in application code and here at the database level.
CREATE TABLE IF NOT EXISTS baskets (
  id           SERIAL PRIMARY KEY,
  name         TEXT UNIQUE NOT NULL CHECK (name ~ '^[a-z0-9]{1,32}$'),
  session_id   TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per captured HTTP request sent to a basket.
-- mongo_raw_id points at a backup copy of the full raw HTTP text in
-- MongoDB, used only for recovery — not read during normal operation.
CREATE TABLE IF NOT EXISTS requests (
  id            SERIAL PRIMARY KEY,
  basket_id     INT NOT NULL REFERENCES baskets(id) ON DELETE CASCADE,
  method        TEXT NOT NULL CHECK (method IN ('GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS')),
  path          TEXT NOT NULL, -- sub-path after the basket name, e.g. "/" or "/foo/bar"
  headers       JSONB NOT NULL,
  content_type  TEXT,
  body          TEXT, -- nullable: NULL = no body sent, '' = empty body sent
  mongo_raw_id  TEXT NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requests_basket_id ON requests(basket_id);
CREATE INDEX IF NOT EXISTS idx_baskets_session_id ON baskets(session_id);
