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

---

## Prerequisites

Install these once per machine:

| Tool | Version | macOS install |
|------|---------|---------------|
| Node.js | 20.12+ (uses `--env-file-if-exists`) | `brew install node` or [nvm](https://github.com/nvm-sh/nvm) |
| Docker Desktop | any recent | `brew install --cask docker` then launch it once |
| Git | any | `brew install git` |
| ngrok | 3.x | `brew install ngrok` — only needed for external webhooks / demos |

Check them:

```bash
node --version      # v20.12+ (or newer)
docker --version    # any
git --version
```

---

## First-time setup on a new machine

### 1. Clone

```bash
git clone https://github.com/NestorVil/t5_requestbin.git
cd t5_requestbin
```

### 2. Install dependencies (root + backend + frontend)

```bash
npm run install:all
```

That runs, in order:

```bash
npm install                     # root: the dev runner (concurrently)
npm install --prefix backend    # express, pg, mongodb, ws, cors
npm install --prefix frontend   # react, react-dom, vite
```

### 3. (optional) Environment files

The defaults are wired for local Docker, so **you can skip this** for plain local
dev. Create them only if you need to override something:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Defaults if you don't:

| Var | Default | Where |
|-----|---------|-------|
| `PORT` | `3001` | backend |
| `DATABASE_URL` | `postgres://requestbin:requestbin@localhost:5433/requestbin` | backend |
| `MONGO_URL` / `MONGO_DB` | `mongodb://localhost:27017` / `requestbin` | backend |
| `CORS_ORIGINS` | `http://localhost:5173` | backend |
| `MAX_BODY_SIZE` | `1mb` | backend |
| `MAX_REQUESTS_PER_BIN` | `100` | backend |
| `VITE_INGEST_BASE` | `http://<current-host>:3001` | frontend (build/dev time) |

### 4. Start the databases

Make sure **Docker Desktop is running** (`open -a Docker` on macOS, wait ~10s), then:

```bash
npm run db:up
```

This is `docker compose up -d` — first run pulls `postgres:16-alpine` and `mongo:7`
(a few hundred MB, one time) and creates named volumes for the data (so it
survives restarts). Postgres is published on host port **5433** (not 5432, so it
won't collide with a Postgres you may already run locally); Mongo on 27017.

Check they're up:

```bash
docker compose ps      # both should say "Up", postgres "(healthy)"
```

### 5. Create the schema

```bash
npm run migrate
```

Applies every `backend/migrations/*.sql` that hasn't run yet (tracked in a
`schema_migrations` table). Safe to run any time; it skips what's already applied.
Expected first-run output:

```
+ applied 001_init.sql
done (1 applied)
```

### 6. Start the app

```bash
npm run dev
```

Starts both servers together (via `concurrently`):

```
[backend]  backend listening on http://localhost:3001
[backend]  websocket on ws://localhost:3001/ws
[frontend]   ➜  Local:   http://localhost:5173/
```

### 7. Verify

```bash
curl http://localhost:3001/health        # {"status":"ok",...}
```

Then open **http://localhost:5173**:

1. Type a name (e.g. `my-first-bin`) and click **Create bin**
2. Click **Send test request** — a `POST /hello` row appears instantly
3. From another terminal, hit the ingest URL and watch it show up live:

   ```bash
   curl -X POST http://localhost:3001/my-first-bin/hook \
     -H 'content-type: application/json' -d '{"hello":"world"}'
   ```

---

## Everyday (after the first setup)

Docker containers restart with Docker Desktop and keep their data, so usually:

```bash
npm run dev
```

Run `npm run migrate` again only after pulling new migration files. Stop the
databases with `npm run db:down` when you want them off (data is preserved).

Run the two servers separately if you prefer:

```bash
npm run dev --prefix backend
npm run dev --prefix frontend
```

---

## Ports and URLs

| What | URL |
|------|-----|
| Web UI | http://localhost:5173 |
| Backend API | http://localhost:3001/api/... |
| Health check | http://localhost:3001/health |
| **Ingest / capture** | `http://localhost:3001/<bin-name>` — any method, any sub-path |
| WebSocket | `ws://localhost:3001/ws?bin=<bin-name>` (proxied via Vite in dev) |
| Postgres | `localhost:5433` (user/pass/db all `requestbin`) |
| MongoDB | `localhost:27017`, database `requestbin` |

`/api`, `/health`, `/bins`, `/b`, `favicon.ico`, `robots.txt` are reserved and
can't be used as bin names. The UI builds the ingest URL from `VITE_INGEST_BASE`
(default `http://<host>:3001`).

---

## Databases

```bash
psql postgres://requestbin:requestbin@localhost:5433/requestbin   # inspect PG
docker compose exec mongo mongosh requestbin                      # inspect Mongo
```

Wipe everything and start clean:

```bash
docker compose down -v     # stops containers AND deletes the volumes
npm run db:up
npm run migrate
```

To change the schema: add `backend/migrations/002_*.sql` and run `npm run migrate`,
or (while there's no real data) edit `001_init.sql` and do the wipe above.

---

## Public URL with ngrok (real webhooks / demos)

Local `localhost` isn't reachable from the internet, so to receive a real webhook
(GitHub, Stripe, …) or show the app from another device, expose the **backend**
(port 3001 — that's where the ingest endpoint lives).

### One-time

1. Sign up (free): https://dashboard.ngrok.com/signup
2. Dashboard → **Your Authtoken** → copy it
3. Register it (writes to ngrok's own config, not this repo):

   ```bash
   ngrok config add-authtoken <YOUR_TOKEN>
   ```

### Each session

With `npm run dev` already running, in a new terminal:

```bash
ngrok http 3001
```

ngrok prints a forwarding URL like `https://ab12-34-56.ngrok-free.app`. That is
your public base:

- Capture / webhook URL: `https://ab12-34-56.ngrok-free.app/<bin-name>`
- Create that exact bin name in the UI first (recreate it if you restart the backend)

To make the UI **display** the public URL instead of `localhost:3001`, run the
frontend with the override (stop `npm run dev` and run them split, or just restart
the frontend):

```bash
VITE_INGEST_BASE=https://ab12-34-56.ngrok-free.app npm run dev --prefix frontend
```

The UI can keep running on `localhost:5173` while you watch requests arrive — only
the backend needs the tunnel.

### Stable URL (recommended)

Free ngrok URLs change every restart. Claim your one free static domain at
dashboard.ngrok.com → **Domains**, then:

```bash
ngrok http --url=<your-name>.ngrok-free.app 3001
```

Now the webhook URL never changes. `ngrok.example.yml` shows a named-tunnel config
if you prefer `ngrok start --all --config ngrok.yml` (running two tunnels at once
needs a paid plan).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `npm run db:up` hangs or errors with "Cannot connect to the Docker daemon" | Docker Desktop isn't running. `open -a Docker`, wait ~10s, retry. |
| `npm run migrate` → `role "requestbin" does not exist` | You have another Postgres on the port `DATABASE_URL` points at. Ours is on **5433**; delete `backend/.env` (or fix its port to 5433) and retry. |
| Backend won't start: `EADDRINUSE :3001` / Vite jumps to `5174` | A previous dev process is still running. `pkill -f "npm run dev"; pkill -f vite`, then `npm run dev` again. |
| UI loads but new requests don't appear live | Backend log should show `websocket on ws://localhost:3001/ws`; `vite.config.js` must have the `/ws` proxy entry; check browser DevTools → Network → WS for a `101` on `/ws`. |
| `docker: command not found` | Docker Desktop not installed / not on PATH — see Prerequisites. |
| Ports 5432 already in use by your own Postgres | Not a problem — this project uses **5433** on the host specifically to avoid it. |
