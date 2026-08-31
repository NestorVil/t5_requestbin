DROP DATABASE IF EXISTS request_basket;
CREATE DATABASE request_basket;

\connect request_basket

CREATE TABLE sessions (
  id VARCHAR PRIMARY KEY
);

CREATE TABLE baskets (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR REFERENCES sessions(id) ON DELETE CASCADE,
  total_count INT DEFAULT 0,
  name VARCHAR(20) UNIQUE NOT NULL
);

CREATE TABLE http_requests (
  id SERIAL PRIMARY KEY,
  basket_id INT REFERENCES baskets(id) ON DELETE CASCADE, 
  method VARCHAR(10),
  headers JSONB,
  body JSONB, 
  received_at TIMESTAMPTZ DEFAULT NOW()
);

