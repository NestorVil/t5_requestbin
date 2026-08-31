CREATE TABLE bins (
  id               BIGSERIAL PRIMARY KEY,
  bin_id           TEXT UNIQUE NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE requests (
  id           BIGSERIAL PRIMARY KEY,
  request_id   TEXT UNIQUE NOT NULL,
  bin_id       BIGINT NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
  method       TEXT NOT NULL,
  path         TEXT NOT NULL,
  query        JSONB NOT NULL DEFAULT '{}'::jsonb,
  headers      JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_type TEXT,
  body_size    INTEGER NOT NULL DEFAULT 0,
  mongo_doc_id TEXT,
  remote_ip    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_requests_bin_created ON requests (bin_id, created_at DESC);
