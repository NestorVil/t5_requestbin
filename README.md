# Request Bin

Create a unique bin, point any HTTP client / webhook at its ingest URL, and watch
every request (method, path, headers, body) stream into a web UI in real time.

- **Postgres** — bins + request metadata
- **MongoDB** — the untouched request payload
- **WebSocket** (`/ws?bin=<binId>`) pushes new requests to the UI; no polling

```
backend/    Express API + capture endpoint (src/ws.js, src/db/, migrations/)
frontend/   React + Vite UI
docker-compose.yml   local Postgres + MongoDB
```

## Prerequisites

- Node 20.12+
- Docker Desktop (installed — `npm run db:up` starts it for you on macOS)
- ngrok 3.x — only for external webhooks / demos

## Setup

```bash
git clone https://github.com/NestorVil/t5_requestbin.git
cd t5_requestbin
npm run install:all      # root + backend + frontend deps
npm run db:up            # launches Docker if needed, then Postgres (:5433) + Mongo (:27017)
npm run migrate          # apply backend/migrations/*.sql
npm run dev              # backend :3001 + frontend :5173
```

On Linux/Windows `db:up` won't auto-launch Docker — start the daemon first, then rerun.

Open http://localhost:5173, create a bin, and send it a request:

```bash
curl -X POST http://localhost:3001/<bin-name>/hook -d '{"hello":"world"}'
```

After the first setup, `npm run dev` is usually all you need. `npm run db:down`
stops the databases (data is kept). Env files are optional — copy
`backend/.env.example` / `frontend/.env.example` only to override a default.

### Expose it with ngrok (for real webhooks / demos)

`localhost` isn't reachable from the internet, so a real webhook sender needs a
public URL to the **backend** (that's where the ingest endpoint lives).

```bash
# once per machine — token from dashboard.ngrok.com → Your Authtoken
ngrok config add-authtoken <TOKEN>

# each session, alongside `npm run dev`
ngrok http 3001
```

ngrok prints `https://<subdomain>.ngrok-free.app`. The webhook / capture URL is
then `https://<subdomain>.ngrok-free.app/<bin-name>` — create that bin in the UI
first (and recreate it if the backend restarts).

To make the UI *display* the public URL instead of `localhost:3001`, restart the
frontend with:

```bash
VITE_INGEST_BASE=https://<subdomain>.ngrok-free.app npm run dev --prefix frontend
```

Free ngrok URLs change on restart. Claim a free static domain (dashboard →
Domains) and use `ngrok http --url=<name>.ngrok-free.app 3001` to keep it stable.

## URLs

| What | URL |
|------|-----|
| UI | http://localhost:5173 |
| Ingest / capture | `http://localhost:3001/<bin-name>` (any method, any sub-path) |
| API / health | `http://localhost:3001/api/...`, `/health` |
| Postgres / Mongo | `localhost:5433` / `localhost:27017` (creds `requestbin`) |

`api`, `health`, `bins`, `b`, `favicon.ico`, `robots.txt` are reserved bin names.
Reset the databases with `docker compose down -v && npm run db:up && npm run migrate`.

## Troubleshooting

- **`role "requestbin" does not exist`** on migrate — a local Postgres is on the
  port your `DATABASE_URL` uses; this project uses **5433** to avoid 5432.
- **`EADDRINUSE :3001`** / Vite jumps to 5174 — a stale dev process:
  `pkill -f "npm run dev"; pkill -f vite`, then rerun.
- **No live updates** — check the backend logs `websocket on ws://localhost:3001/ws`
  and DevTools → Network → WS shows a `101` on `/ws`.
