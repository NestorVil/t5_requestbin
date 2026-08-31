import express from 'express';
import cors from 'cors';

import {
  createBin,
  getBin,
  deleteBin,
  addRequest,
  listRequests,
  getRequest,
  clearRequests,
} from './store.js';

const PORT = Number(process.env.PORT ?? 3001);
const MAX_BODY_SIZE = process.env.MAX_BODY_SIZE ?? '1mb';
const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

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

api.post('/bins', (req, res) => {
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
  if (getBin(binId)) {
    return res.status(409).json({ error: 'that name is already taken' });
  }
  const bin = createBin(binId);
  res.status(201).json(serializeBin(bin));
});

api.get('/bins/:binId', (req, res) => {
  const bin = getBin(req.params.binId);
  if (!bin) return res.status(404).json({ error: 'bin not found' });
  res.json(serializeBin(bin));
});

api.delete('/bins/:binId', (req, res) => {
  const ok = deleteBin(req.params.binId);
  if (!ok) return res.status(404).json({ error: 'bin not found' });
  res.status(204).end();
});

api.get('/bins/:binId/requests', (req, res) => {
  const requests = listRequests(req.params.binId);
  if (requests === null) return res.status(404).json({ error: 'bin not found' });
  res.json({ requests });
});

api.get('/bins/:binId/requests/:requestId', (req, res) => {
  const request = getRequest(req.params.binId, req.params.requestId);
  if (!request) return res.status(404).json({ error: 'request not found' });
  res.json(request);
});

api.delete('/bins/:binId/requests', (req, res) => {
  const ok = clearRequests(req.params.binId);
  if (!ok) return res.status(404).json({ error: 'bin not found' });
  res.status(204).end();
});

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
  (req, res) => {
    const { binId } = req.params;
    if (RESERVED.has(binId.toLowerCase())) {
      return res.status(404).json({ error: 'not found' });
    }

    const bin = getBin(binId);
    if (!bin) return res.status(404).json({ error: 'bin not found' });

    const rawBody = Buffer.isBuffer(req.body) && req.body.length
      ? req.body.toString('utf8')
      : '';

    const subPath = req.params[0] ? `/${req.params[0]}` : '';

    const request = addRequest(binId, {
      method: req.method,
      path: subPath || '/',
      query: req.query,
      headers: req.headers,
      contentType: req.headers['content-type'] ?? null,
      bodySize: Buffer.isBuffer(req.body) ? req.body.length : 0,
      body: rawBody,
      remoteIp: req.ip,
    });

    res.status(200).json({ ok: true, binId, requestId: request.id });
  }
);

app.use((_req, res) => res.status(404).json({ error: 'not found' }));

app.listen(PORT, () => {
  console.log(`[requestbin] backend listening on http://localhost:${PORT}`);
  console.log(`[requestbin] CORS origins: ${CORS_ORIGINS.join(', ')}`);
});

function serializeBin(bin) {
  return {
    binId: bin.binId,
    createdAt: bin.createdAt,
    requestCount: bin.requests.length,
  };
}
