DROP DATABASE IF EXISTS request_basket;
CREATE DATABASE request_basket;

\connect request_basket

CREATE TABLE sessions (
  id SERIAL PRIMARY KEY
);

CREATE TABLE baskets (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES sessions(id) ON DELETE CASCADE,
  total_count INT,
  name VARCHAR(20) UNIQUE NOT NULL
);

CREATE TABLE http_requests (
  id SERIAL PRIMARY KEY,
  basket_id INT REFERENCES baskets(id) ON DELETE CASCADE, 
  method VARCHAR(10),
  headers JSONB,
  body JSONB, 
  received_at TIMESTAMP
);

INSERT INTO sessions
DEFAULT VALUES;

INSERT INTO sessions
DEFAULT VALUES;

INSERT INTO baskets (session_id, total_count, name)
VALUES
    (1, 0, 'abc1234'),
    (2, 0, 'xyz5678');

INSERT INTO http_requests (
    basket_id,
    method,
    headers,
    body,
    received_at
)
VALUES
(
    1,
    'POST',
    '{"content-type": "application/json", "user-agent": "GitHub-Hookshot"}',
    '{"event": "push", "repository": "my-project"}',
    NOW()
),
(
    2,
    'GET',
    '{"accept": "application/json", "user-agent": "Mozilla/5.0"}',
    '{"accept": "application/json",   "user-agent": "Mozilla/5.0",   "host": "example.com",   "connection": "keep-alive" }',
    NOW()
);