import express from 'express';
import cors from 'cors';

import { pool, closePg } from './db/pg.js';
import { connectMongo, closeMongo } from './db/mongo.js';
import { attachWs, broadcast } from './ws.js';
import {
  createBin,
  getBin,
  deleteBin,
  addRequest,
  listRequests,
  getRequest,
  clearRequests,
  BinExistsError,
} from './store.js';

const PORT = Number(process.env.PORT ?? 3001);
const MAX_BODY_SIZE = process.env.MAX_BODY_SIZE ?? '1mb';
const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// wrap an async route handler so rejections reach the error middleware
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const app = express();
app.disable('x-powered-by');

// tiny request logger (replaces morgan)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// ---------------------------------------------------------------------------
// API (consumed by the React UI)
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const api = express.Router();
api.use(cors({ origin: CORS_ORIGINS }));
api.use(express.json());

const BIN_ID_RE = /^[A-Za-z0-9_-]{3,64}$/;
// paths the backend serves itself - can't be used as bin names
const RESERVED = new Set(['api', 'health', 'b', 'bins', 'favicon.ico', 'robots.txt']);

api.post(
  '/bins',
  h(async (req, res) => {
    const binId = typeof req.body?.binId === 'string' ? req.body.binId.trim() : '';
    if (!binId) {
      return res.status(400).json({ error: 'binId is required' });
    }
    if (!BIN_ID_RE.test(binId)) {
      return res.status(400).json({
        error: 'binId must be 3-64 characters: letters, numbers, hyphen, underscore',
      });
    }
    if (RESERVED.has(binId.toLowerCase())) {
      return res.status(400).json({ error: 'that name is reserved, pick another' });
    }
    try {
      const bin = await createBin(binId);
      res.status(201).json(bin);
    } catch (err) {
      if (err instanceof BinExistsError) {
        return res.status(409).json({ error: 'that name is already taken' });
      }
      throw err;
    }
  })
);

api.get(
  '/bins/:binId',
  h(async (req, res) => {
    const bin = await getBin(req.params.binId);
    if (!bin) return res.status(404).json({ error: 'bin not found' });
    res.json(bin);
  })
);

api.delete(
  '/bins/:binId',
  h(async (req, res) => {
    const ok = await deleteBin(req.params.binId);
    if (!ok) return res.status(404).json({ error: 'bin not found' });
    broadcast(req.params.binId, { type: 'bin:deleted' });
    res.status(204).end();
  })
);

api.get(
  '/bins/:binId/requests',
  h(async (req, res) => {
    const requests = await listRequests(req.params.binId);
    if (requests === null) return res.status(404).json({ error: 'bin not found' });
    res.json({ requests });
  })
);

api.get(
  '/bins/:binId/requests/:requestId',
  h(async (req, res) => {
    const request = await getRequest(req.params.binId, req.params.requestId);
    if (!request) return res.status(404).json({ error: 'request not found' });
    res.json(request);
  })
);

api.delete(
  '/bins/:binId/requests',
  h(async (req, res) => {
    const ok = await clearRequests(req.params.binId);
    if (!ok) return res.status(404).json({ error: 'bin not found' });
    broadcast(req.params.binId, { type: 'requests:cleared' });
    res.status(204).end();
  })
);

app.use('/api', api);

app.get('/', (_req, res) => {
  res.type('text').send('Request Bin backend. POST to /<bin-name> to capture; API under /api');
});

// ---------------------------------------------------------------------------
// Capture endpoint - anything sent to /<binId> (any method, any sub-path)
// Must stay last: it matches every remaining single-segment path.
// ---------------------------------------------------------------------------
app.all(
  ['/:binId', '/:binId/*'],
  cors(),
  express.raw({ type: () => true, limit: MAX_BODY_SIZE }),
  h(async (req, res) => {
    const { binId } = req.params;
    if (RESERVED.has(binId.toLowerCase())) {
      return res.status(404).json({ error: 'not found' });
    }

    const rawBody =
      Buffer.isBuffer(req.body) && req.body.length ? req.body.toString('utf8') : '';
    const subPath = req.params[0] ? `/${req.params[0]}` : '';

    const request = await addRequest(binId, {
      method: req.method,
      path: subPath || '/',
      url: req.originalUrl,
      query: req.query,
      headers: req.headers,
      contentType: req.headers['content-type'] ?? null,
      bodySize: Buffer.isBuffer(req.body) ? req.body.length : 0,
      body: rawBody,
      remoteIp: req.ip,
    });

    if (!request) return res.status(404).json({ error: 'bin not found' });

    // answer the sender as soon as the request is persisted
    res.status(200).json({ ok: true, binId, requestId: request.id });

    // then notify watchers - best-effort, never affects the response
    try {
      const { body, ...summary } = request;
      broadcast(binId, { type: 'request:new', request: summary });
    } catch (err) {
      console.error('[ws] broadcast failed', err);
    }
  })
);

app.use((_req, res) => res.status(404).json({ error: 'not found' }));

// error middleware - last
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'internal error' });
});

async function start() {
  await connectMongo();
  await pool.query('SELECT 1'); // fail fast if Postgres is unreachable
  const server = app.listen(PORT, () => {
    console.log(`[requestbin] backend listening on http://localhost:${PORT}`);
    console.log(`[requestbin] websocket on ws://localhost:${PORT}/ws`);
    console.log(`[requestbin] CORS origins: ${CORS_ORIGINS.join(', ')}`);
  });
  const wss = attachWs(server);

  const shutdown = async (signal) => {
    console.log(`\n[requestbin] ${signal} - shutting down`);
    wss.close();
    server.close();
    await Promise.allSettled([closePg(), closeMongo()]);
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('[requestbin] failed to start:', err.message);
  process.exit(1);
});
