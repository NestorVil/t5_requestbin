const express = require('express');
const basketService = require('../services/basketService');
const wsService = require('../services/wsService');
const db = require('../db/postgres');
const asyncHandler = require('../middleware/asyncHandler');
const { parsePaginationParam } = require('../utils/pagination');

const router = express.Router();

// Create a new basket. Expects { name } in the body — the frontend is
// responsible for generating the initial 8-character suggestion and
// letting the user edit it before submitting here.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name } = req.body || {};

    if (!basketService.isValidName(name)) {
      return res.status(400).json({
        error: 'Invalid name — must be 1-32 lowercase letters and numbers only',
      });
    }

    if (await basketService.nameExists(name)) {
      return res.status(409).json({ error: 'That name is already taken' });
    }

    const basket = await basketService.createBasket(name, req.sessionId);
    res.status(201).json({
      name: basket.name,
      captureUrl: `/basket/${basket.name}`,
      requestsUrl: `/api/baskets/${basket.name}/requests`,
      streamUrl: `/api/baskets/${basket.name}/stream`, // connect with a WebSocket client, not a normal GET
      createdAt: basket.created_at,
    });
  })
);

// List baskets belonging to the current session (the frontend's "your baskets" view)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const baskets = await basketService.listBasketsForSession(req.sessionId);
    res.json({ baskets });
  })
);

// List captured requests for a basket (most recent first), paginated
router.get(
  '/:name/requests',
  asyncHandler(async (req, res) => {
    const basket = await basketService.getBasketByName(req.params.name);
    if (!basket) return res.status(404).json({ error: 'Basket not found' });

    const limitResult = parsePaginationParam(req.query.limit, { defaultValue: 50, max: 200 });
    if (limitResult.error) {
      return res.status(400).json({ error: `Invalid limit: ${limitResult.error}` });
    }

    const offsetResult = parsePaginationParam(req.query.offset, { defaultValue: 0 });
    if (offsetResult.error) {
      return res.status(400).json({ error: `Invalid offset: ${offsetResult.error}` });
    }

    const { value: limit } = limitResult;
    const { value: offset } = offsetResult;

    const result = await db.query(
      `SELECT id, basket_id, method, path, headers, content_type, body, mongo_raw_id, received_at,
              COUNT(*) OVER() AS total_count
       FROM requests WHERE basket_id = $1
       ORDER BY received_at DESC
       LIMIT $2 OFFSET $3`,
      [basket.id, limit, offset]
    );

    // COUNT(*) OVER() attaches the same total to every row, so it's only
    // present when there's at least one row in this page. With zero results
    // (e.g. offset past the end, or no requests yet), fall back to 0.
    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    const requests = result.rows.map(({ total_count, ...row }) => row);

    res.json({ requests, totalCount, limit, offset });
  })
);

// Manually delete a whole basket (and, via ON DELETE CASCADE, all of its requests)
router.delete(
  '/:name',
  asyncHandler(async (req, res) => {
    const basket = await basketService.getBasketByName(req.params.name);
    if (!basket) return res.status(404).json({ error: 'Basket not found' });

    await basketService.deleteBasket(basket.id);
    // Anyone currently watching this basket's live stream needs to be
    // disconnected — otherwise their WebSocket just stays open forever,
    // silently receiving nothing, with no indication the basket is gone.
    wsService.closeBasketConnections(basket.id);

    res.status(204).send();
  })
);

module.exports = router;
