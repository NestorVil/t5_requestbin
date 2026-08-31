import { WebSocketServer } from 'ws';

/**
 * Minimal pub/sub over WebSocket. One "room" per bin; clients connect to
 * /ws?bin=<binId> and receive { type, ... } messages for that bin only.
 */

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const rooms = new Map();

function join(binId, ws) {
  if (!rooms.has(binId)) rooms.set(binId, new Set());
  rooms.get(binId).add(ws);
}

function leave(binId, ws) {
  const set = rooms.get(binId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) rooms.delete(binId);
}

/** Send a JSON payload to every client watching `binId`. */
export function broadcast(binId, payload) {
  const set = rooms.get(binId);
  if (!set) return;
  const msg = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

export function attachWs(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const binId = new URL(req.url, 'http://localhost').searchParams.get('bin');
    if (!binId) {
      ws.close(1008, 'bin query param required');
      return;
    }
    ws.isAlive = true;
    join(binId, ws);

    ws.on('pong', () => {
      ws.isAlive = true;
    });
    ws.on('close', () => leave(binId, ws));
    ws.on('error', () => leave(binId, ws));
  });

  // drop connections that stopped responding to pings
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));
  return wss;
}
