const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
const { connectMongo } = require('./db/mongo');
const sessionMiddleware = require('./middleware/session');
const errorHandler = require('./middleware/errorHandler');
const wsService = require('./services/wsService');
const { startCleanupJob } = require('./services/cleanupService');

const basketsRouter = require('./routes/baskets');
const captureRouter = require('./routes/capture');

const app = express();

// credentials: true is required for the session cookie to be sent/accepted
// on cross-origin requests (e.g. a frontend dev server on a different
// port) — without it, the browser won't include cookies on cross-origin
// fetch calls even with the right Origin allowed.
app.use(
  '/api/baskets',
  cors({ origin: config.cors.allowedOrigin, credentials: true }),
  cookieParser(),
  sessionMiddleware,
  express.json(),
  basketsRouter
);

// The capture routes use express.text() with a type matcher that accepts
// every request regardless of Content-Type, since bodies are assumed to
// always be plain text (per project decision — no binary handling). An
// explicit limit replaces Express's default (100kb), which real-world
// webhook payloads can easily exceed.
app.use('/basket', express.text({ type: () => true, limit: config.capture.bodyLimit }), captureRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Must be registered after every route/router above — Express identifies
// error-handling middleware by its 4-argument signature, and only routes
// registered before this point will have their errors forwarded here.
app.use(errorHandler);

// A plain http.Server (rather than app.listen()) is required so we can
// also listen for the 'upgrade' event that WebSocket connections start
// with — Express itself has no concept of protocol upgrades, only normal
// request/response cycles.
const httpServer = http.createServer(app);
wsService.attach(httpServer);

async function start() {
  await connectMongo();
  // pg's Pool connects lazily on first query — nothing to await here.

  startCleanupJob();

  httpServer.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
