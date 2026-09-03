DROP DATABASE IF EXISTS request_basket;
CREATE DATABASE request_basket;

\connect request_basket

CREATE TABLE sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL 
);

CREATE TABLE baskets (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR REFERENCES sessions(sid) ON DELETE CASCADE,
  total_count INT DEFAULT 0,
  name VARCHAR(20) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE http_requests (
  id SERIAL PRIMARY KEY,
  basket_id INT REFERENCES baskets(id) ON DELETE CASCADE, 
  method VARCHAR(10),
  headers JSONB,
  body JSONB,
  path TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

