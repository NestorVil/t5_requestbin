# Request Bin (Team 5)

A "request bin" tool: create a unique bin, point any HTTP client / webhook at its
ingest URL, and inspect every request (method, path, headers, body) in a web UI.

> Scaffold stage — **no databases yet**. Requests are held in memory in the
> backend process and are lost on restart. Postgres + MongoDB come later.

## Layout

```
backend/    Express API + request-capture endpoint (in-memory store for now)
frontend/   React + Vite single-page UI
ngrok.yml   ngrok tunnel config (git-ignored; copy from ngrok.example.yml)
```

## Prerequisites

- Node 20+ (`node --version`)
- ngrok account + CLI (see "Testing over ngrok" below)

## Install

```bash
npm install            # root: installs the dev runner (concurrently)
npm install --prefix backend
npm install --prefix frontend
```

## Run (local)

```bash
npm run dev            # starts backend :3001 and frontend :5173 together
```

- UI:            http://localhost:5173
- API health:    http://localhost:3001/health
- Ingest URL:    http://localhost:3001/b/<binId>   (proxied as /b/... from the UI origin)

Run them separately if you prefer:

```bash
npm run dev --prefix backend
npm run dev --prefix frontend
```

## Testing over ngrok

The UI needs to be reachable from another device / an external webhook sender.

1. Install the CLI: `brew install ngrok` (already done on this machine).
2. Create a free account at https://dashboard.ngrok.com, open **Your Authtoken**,
   and copy it.
3. Register it once (writes to ngrok's own config, not this repo):

   ```bash
   ngrok config add-authtoken <YOUR_TOKEN>
   ```

4. Start `npm run dev`, then in another terminal:

   ```bash
   ngrok http 5173
   ```

   ngrok prints a `https://<random>.ngrok-free.app` URL. Open it to use the UI
   from anywhere. Vite proxies `/api` and `/b/...` to the backend, so that one
   URL also accepts captured requests:
   `https://<random>.ngrok-free.app/b/<binId>`.

Vite is configured with `allowedHosts: true`, so the ngrok domain is accepted
without further config. The optional `ngrok.example.yml` shows a named-tunnel
setup (`cp ngrok.example.yml ngrok.yml && ngrok start --all --config ngrok.yml`);
running two tunnels at once requires a paid ngrok plan.
