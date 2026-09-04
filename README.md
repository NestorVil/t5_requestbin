# Request Basket

A small self-hosted clone of RequestBin: create a "basket," get a unique
webhook URL for it, and watch incoming HTTP requests (headers + body) show
up live in the browser as they arrive.

It's a two-app project:

- **`backend/`** — a Node/Express API that stores baskets and captured
  requests in PostgreSQL, mirrors a raw copy of every captured request to
  MongoDB as a best-effort audit log, and pushes live updates to the
  browser over Socket.io. A cron job automatically expires and deletes old
  baskets.
- **`frontend/`** — a React app (built with Vite) where you create a
  basket, copy its webhook URL, unlock it with an access token, and watch
  requests come in.

## How it works

```
 Browser (React, :5173) <----- Socket.io push ----- Backend (Express, :3000) <---> PostgreSQL (:5432)
        |                                                    |
        | HTTP (via Vite's /api proxy)                       +---> MongoDB (raw request log)
        +----------------------------------------------------+

 External service -- ANY method, /basket/<name>[/...] --> Backend --> stored in Postgres
                                                                    --> mirrored to MongoDB
                                                                    --> broadcast over Socket.io --> Basket page updates live
```

- The frontend never talks to Postgres or MongoDB directly — it only calls
  the backend's `/api/...` routes (proxied by Vite in dev, see
  `frontend/vite.config.js`) and listens on a Socket.io connection.
- **There's no login system, and no session cookie.** Ownership of a
  basket is proven with a bearer access token instead: creating a basket
  returns a one-time token, which the frontend saves to that browser's
  `localStorage` and sends back as `Authorization: Bearer <token>` on
  requests that need to prove ownership (viewing a basket's captured
  requests, deleting it). The backend only ever stores a hash of the
  token — see [`docs/API.md`](docs/API.md#authentication). There is no
  server-side "list of my baskets" anymore; the frontend's basket list is
  just whatever tokens happen to be sitting in that browser's
  `localStorage`.
- Baskets expire automatically **30 days** after creation. A cron job
  sweeps expired baskets every 20 seconds; if the basket you're currently
  viewing gets swept, the frontend bounces you back to the home page over
  Socket.io.
- Every captured request is written to Postgres (the source of truth for
  the UI) and, best-effort, mirrored as raw HTTP text to a MongoDB
  `raw_requests` collection. If MongoDB is unreachable, the app logs the
  error and keeps going — Postgres capture still works.
- See [`docs/API.md`](docs/API.md) for the full endpoint list and
  [`docs/SCHEMA.md`](docs/SCHEMA.md) for the database tables.

## Prerequisites

- Node.js (LTS) and npm
- A PostgreSQL server running locally, with a `postgres` role you know the
  password for (the backend connects as user `postgres` on
  `localhost:5432` — see [Known issues](#known-issues--gotchas) below)
- A MongoDB instance reachable from the backend (a free MongoDB Atlas
  cluster works fine). It's only used for the best-effort raw-request log
  described above — the app doesn't crash without it, but you'll see
  connection errors logged until `MONGO_URI` / `MONGO_DB_NAME` are set
  correctly.

## Project structure

```
backend/     Express API, Socket.io server, DB access (Postgres + Mongo)
frontend/    React + Vite single-page app
docs/        API and schema reference
```

## Getting started

### 1. Create the database

`backend/reset.sql` drops and recreates the `request_basket` database and
its tables (`baskets`, `http_requests`). Run it against your local
Postgres server:

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
| `SECRET`             | Present in `.env.example`, but not currently read anywhere in `backend/index.js` — a leftover from an earlier session-cookie-based version of the app. Set it to any placeholder value; it has no effect right now. |
| `POSTGRES_PASSWORD`  | The password for your local `postgres` role (from step 1). |
| `MONGO_URI`          | Your MongoDB connection string (e.g. starts with `mongodb+srv://` for Atlas). |
| `MONGO_DB_NAME`      | The database name to use on that Mongo instance. |

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

For a production build (not proxied through Vite dev server), the
frontend needs two build-time env vars — `VITE_API_URL` and
`VITE_SOCKET_URL` — pointing at wherever the backend is actually deployed
(see `frontend/src/communications/communications.jsx` and
`frontend/src/components/BasketPage.jsx`/`HomePage.jsx`, which fall back
to these whenever `window.location.hostname` isn't `localhost`). There's
no `frontend/.env.example` checked in yet, so set these directly in your
deploy environment.

### 4. Try it out

1. Open http://localhost:5173/web — a basket name is generated for you.
2. Click **Create**. A popup shows your basket's access token — this is
   the only time it's shown, so copy it if you'll need it on another
   device or browser (the current browser also saves it automatically to
   `localStorage`, so you don't need it to keep using this basket here).
   You'll land on `/web/<basketName>`.
3. From a separate terminal, send it a request:
   ```bash
   curl -X POST http://localhost:3000/basket/<basketName> \
     -H "Content-Type: application/json" \
     -d '{"hello": "world"}'
   ```
   Any HTTP method works, and anything under
   `/basket/<basketName>/...` is captured too, not just the bare path.
4. It should appear in the basket page immediately (pushed over
   Socket.io) without a page refresh.

## Developer notes

### The webhook URL shown in the UI is hardcoded to production

`frontend/src/components/RequestPageHeader.jsx` currently builds the
webhook URL shown (and copied by the **Copy** button) as
`https://t5-requestbin.onrender.com/basket/<basketName>` — always, in
every environment. When developing locally, that URL will **not** hit
your local backend; you need to substitute
`http://localhost:3000/basket/<basketName>` by hand.

If you want to test with a webhook that's reachable from the public
internet (most real-world webhook senders can't reach `localhost`), tunnel
your local backend with [ngrok](https://ngrok.com/):

```bash
ngrok http 3000
```

This gives you a forwarding URL like `https://<random>.ngrok-free.app`
that proxies to your local backend. Point an external service's webhook
config (or `curl`, as in step 4 above) at
`https://<your-ngrok-domain>/basket/<basketName>` instead of the URL shown
in the UI.

## Known issues / gotchas

- **Live updates aren't scoped per basket.** The backend broadcasts
  `webhook-update` to every connected Socket.io client; the frontend
  filters client-side by comparing `basketName`. Harmless in practice, but
  every open tab receives every basket's traffic.
- **A lost access token means lost access.** The server only stores a
  SHA-256 hash of each basket's token, so there's no recovery flow — if
  you clear browser storage or switch browsers/devices without having
  copied the token, you can no longer view that basket's requests or
  delete it. It'll still get cleaned up automatically once it expires (30
  days after creation).
- **The webhook URL shown in the UI defaults to production**, not your
  local backend — see [Developer notes](#the-webhook-url-shown-in-the-ui-is-hardcoded-to-production)
  above.
- **`baskets.total_count`** is defined in the schema (see
  [`docs/SCHEMA.md`](docs/SCHEMA.md)) but nothing in the code currently
  reads or writes it.
- **There's no way to list "my baskets" from the server anymore.** The old
  `GET /api/baskets` route (which used a session cookie) is commented out
  in `backend/index.js`. The frontend now derives its basket list purely
  from whichever `basket_<name>` tokens exist in that browser's
  `localStorage` — see `frontend/src/communications/communications.jsx`.
