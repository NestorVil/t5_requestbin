# Request Bin (Team 5)

A "request bin" tool: create a unique bin, point any HTTP client / webhook at its
ingest URL, and watch every request (method, path, headers, body) stream into a
web UI in real time.

Storage: **Postgres** holds bins + request metadata, **MongoDB** holds the
untouched request payload (so nothing is lost if parsing changes). New requests
are pushed to the UI over a **WebSocket** (`/ws?bin=<binId>`); no polling.

## Layout

```
backend/            Express API + request-capture endpoint
  src/db/           pg + mongo connection helpers
  src/ws.js         WebSocket fan-out, one room per bin
  migrations/       plain .sql files, applied by src/migrate.js
frontend/           React + Vite single-page UI
docker-compose.yml  local Postgres + MongoDB
ngrok.example.yml   ngrok tunnel config template
```

## Prerequisites

- Node 20+ (`node --version`)
- Docker Desktop (for the databases)
- ngrok account + CLI (only for external webhook testing)

## Install

```bash
npm install            # root: dev runner (concurrently)
npm install --prefix backend
npm install --prefix frontend
```

## Run (local)

```bash
npm run db:up          # start Postgres + Mongo (docker compose up -d)
npm run migrate        # create/upgrade the Postgres schema
npm run dev            # backend :3001 and frontend :5173 together
```

`npm run db:down` stops the databases (data is kept in named volumes).

- UI:            http://localhost:5173
- API health:    http://localhost:3001/health
- Ingest URL:    http://localhost:3001/<bin-name>   (the backend's root; any method, any sub-path)

The ingest endpoint lives at the backend origin's root. `/api`, `/health`,
`/bins`, `/b` and a couple of file names are reserved and can't be bin names.
The UI derives the ingest base from `VITE_INGEST_BASE` (see `frontend/.env.example`),
defaulting to `http://<host>:3001`.

Run them separately if you prefer:

```bash
npm run dev --prefix backend
npm run dev --prefix frontend
```

### Databases

`docker-compose.yml` runs `postgres:16` on host port **5433** (to dodge a local
Postgres on 5432) and `mongo:7` on 27017, creds `requestbin:requestbin`.
Connection strings live in `backend/.env` (copy from `backend/.env.example`);
the defaults already match Compose, so `.env` is optional for local dev.

- `npm run migrate` — apply pending `backend/migrations/*.sql`
- Inspect: `psql postgres://requestbin:requestbin@localhost:5433/requestbin`
- Reset everything: `docker compose down -v` (drops the volumes), then `db:up` + `migrate`

## Testing over ngrok

For an external webhook sender (e.g. GitHub) to reach a bin, the **backend**
needs a public URL.

1. Install the CLI: `brew install ngrok` (already done on this machine).
2. Create a free account at https://dashboard.ngrok.com, open **Your Authtoken**,
   and copy it.
3. Register it once (writes to ngrok's own config, not this repo):

   ```bash
   ngrok config add-authtoken <YOUR_TOKEN>
   ```

4. Start `npm run dev`, then in another terminal tunnel the backend:

   ```bash
   ngrok http 3001
   ```

   ngrok prints a `https://<random>.ngrok-free.app` URL. Webhook / capture URL:
   `https://<random>.ngrok-free.app/<bin-name>`.

5. So the UI shows that same public URL (instead of `localhost:3001`), run the
   frontend with:

   ```bash
   VITE_INGEST_BASE=https://<random>.ngrok-free.app npm run dev --prefix frontend
   ```

The UI itself only needs to run locally while you watch requests arrive. Claim
your one free static domain at dashboard.ngrok.com -> **Domains** and use
`ngrok http --url=<name>.ngrok-free.app 3001` so the URL survives restarts.
