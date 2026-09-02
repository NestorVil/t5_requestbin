# Request Basket

A small self-hosted clone of RequestBin: create a "basket," get a unique
webhook URL for it, and watch incoming HTTP requests (headers + body) show
up live in the browser as they arrive.

It's a two-app project:

- **`backend/`** — a Node/Express API that stores baskets and captured
  requests in PostgreSQL, and pushes live updates to the browser over
  Socket.io.
- **`frontend/`** — a React app (built with Vite) where you create a
  basket, copy its webhook URL, and watch requests come in.

## How it works

```
 Browser (React, :5173) <----- Socket.io push ----- Backend (Express, :3000) <---> PostgreSQL (:5432)
        |                                                    ^
        | HTTP (via Vite's /api proxy)                       |
        +----------------------------------------------------+

 External service ---- POST /<basketName> ----> Backend ---> stored in DB ---> broadcast over Socket.io ---> Basket page updates live
```

- The frontend never talks to Postgres directly — it only calls the
  backend's `/api/...` routes (proxied by Vite in dev, see
  `frontend/vite.config.js`) and listens on a Socket.io connection for a
  `webhook-update` event.
- The backend is the only thing that talks to the database. It also uses
  `express-session` (backed by Postgres, via `connect-pg-simple`) to
  associate baskets with a browser session — there's no login system,
  "your baskets" just means "baskets created by whoever holds this
  session cookie."
- See [`docs/API.md`](docs/API.md) for the full endpoint list and
  [`docs/SCHEMA.md`](docs/SCHEMA.md) for the database tables.

## Prerequisites

- Node.js (LTS) and npm
- A PostgreSQL server running locally, with a `postgres` role you know the
  password for (the backend connects as user `postgres` on
  `localhost:5432` — see [Known issues](#known-issues--gotchas) below)

## Project structure

```
backend/     Express API, Socket.io server, DB access
frontend/    React + Vite single-page app
docs/        API and schema reference
```

## Getting started

### 1. Create the database

`backend/reset.sql` drops and recreates the `request_basket` database and
its tables (`sessions`, `baskets`, `http_requests`). Run it against your
local Postgres server:

```bash
psql -U postgres -f backend/reset.sql
```

You'll be prompted for the `postgres` role's password. (You can re-run
this any time you want to wipe local data back to a clean slate — that's
what it's for.)

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and fill in:

| Variable            | Description                                              |
| ------------------- | --------------------------------------------------------- |
| `SECRET`             | Any random string — used to sign the session cookie.     |
| `POSTGRES_PASSWORD`  | The password for your local `postgres` role (from step 1). |

Then start the server:

```bash
npm start
```

This runs `node --watch --env-file=.env index.js`, which restarts on file
changes. The API listens on **http://localhost:3000**.

### 3. Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite serves the app at **http://localhost:5173** and proxies any
`/api/...` request to the backend on port 3000 (see
`frontend/vite.config.js`). Visiting `/` redirects to `/web`.

### 4. Try it out

1. Open http://localhost:5173/web — a basket name is generated for you.
2. Click **Create**. You'll land on `/web/<basketName>`.
3. From a separate terminal, send it a request:
   ```bash
   curl -X POST http://localhost:3000/<basketName> \
     -H "Content-Type: application/json" \
     -d '{"hello": "world"}'
   ```
4. It should appear in the basket page immediately (pushed over
   Socket.io) without a page refresh.

## Developer notes

### Using ngrok for webhook testing

A basket's whole point is to receive webhooks from *external* services,
but `localhost:3000` isn't reachable from the public internet. For
development we use [ngrok](https://ngrok.com/) to tunnel a public URL to
the locally running backend:

```bash
ngrok http 3000
```

This gives you a forwarding URL like `https://<random>.ngrok-free.app`
that proxies to your local backend on port 3000. Point an external
service's webhook config (or just `curl`, like in step 4 above) at
`https://<your-ngrok-domain>/<basketName>` and it'll reach your machine
the same way it would in production.

This is also what the `<ngrok domain name>` placeholder in
`frontend/src/components/BasketPage.jsx` is for — the webhook URL shown
on the basket page is meant to reflect your *current* ngrok forwarding
URL. Right now there's no config for this, so it has to be edited by
hand each time your ngrok URL changes (see below).
