const { WebSocketServer } = require('ws');
const basketService = require('./basketService');

// Tracks open WebSocket connections per basket (by internal id), so a
// newly captured request can be pushed live to anyone currently watching.
// subscribers: Map<basketId, Set<WebSocket>>
const subscribers = new Map();

const STREAM_PATH_PATTERN = /^\/api\/baskets\/([^/]+)\/stream$/;

// Attaches WebSocket handling to an existing HTTP server. This has to work
// at the raw http.Server level (listening for the 'upgrade' event) rather
// than as an Express route, since Express only handles normal HTTP
// request/response cycles — it has no concept of a protocol upgrade.
function attach(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', async (req, socket, head) => {
    let pathname;
    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
    } catch {
      socket.destroy();
      return;
    }

    const match = pathname.match(STREAM_PATH_PATTERN);
    if (!match) {
      socket.destroy();
      return;
    }

    const basketName = match[1];
    let basket;
    try {
      basket = await basketService.getBasketByName(basketName);
    } catch (err) {
      console.error('Error looking up basket during WebSocket upgrade', err);
      socket.destroy();
      return;
    }

    if (!basket) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      subscribe(basket.id, ws);
    });
  });
}

function subscribe(basketId, ws) {
  if (!subscribers.has(basketId)) {
    subscribers.set(basketId, new Set());
  }
  subscribers.get(basketId).add(ws);

  ws.on('close', () => {
    const clients = subscribers.get(basketId);
    if (!clients) return;
    clients.delete(ws);
    // Remove the Map entry entirely once nobody's watching this basket
    // anymore — otherwise a long-running server slowly accumulates empty
    // Sets for every basket that's ever been watched, even after every
    // client has disconnected.
    if (clients.size === 0) {
      subscribers.delete(basketId);
    }
  });
}

function broadcast(basketId, data) {
  const clients = subscribers.get(basketId);
  if (!clients || clients.size === 0) return;

  const payload = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(payload);
    }
  }
}

// Closes every open connection watching a basket, e.g. when it's deleted
// (manually or by the cleanup job) — otherwise those clients would just
// sit connected indefinitely, never receiving anything again, with no
// indication the basket is actually gone.
function closeBasketConnections(basketId) {
  const clients = subscribers.get(basketId);
  if (!clients) return;

  for (const ws of clients) {
    // 4000-4999 is the range reserved for application-defined close codes.
    ws.close(4004, 'Basket deleted');
  }
  subscribers.delete(basketId);
}

module.exports = { attach, broadcast, closeBasketConnections };
