DROP DATABASE IF EXISTS request_basket;
CREATE DATABASE request_basket;

\connect request_basket

CREATE TABLE baskets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(20) UNIQUE NOT NULL,
  token_hash CHAR(64) NOT NULL,
  total_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE http_requests (
  id SERIAL PRIMARY KEY,
  basket_id INT REFERENCES baskets(id) ON DELETE CASCADE, 
  method VARCHAR(10),
  headers JSONB,
  body JSONB, 
  received_at TIMESTAMPTZ DEFAULT NOW()
);

