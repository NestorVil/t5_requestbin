const express = require('express');
const basketService = require('../services/basketService');
const requestService = require('../services/requestService');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const handleCapture = asyncHandler(async (req, res) => {
  const basket = await basketService.getBasketByName(req.params.name);
  if (!basket) return res.status(404).json({ error: 'Basket not found' });

  // req.params[0] only exists on the wildcard route match (everything after
  // /:name/); a request to the basket's bare root has nothing to capture there.
  const path = req.params[0] ? `/${req.params[0]}` : '/';

  const record = await requestService.captureRequest(basket.id, req, path);
  res.status(200).json({ captured: true, requestId: record.id });
});

// Two routes are needed: Express's wildcard pattern below requires at least
// one path segment after the basket name, so a request to the bare
// /basket/:name root needs its own exact-match route.
router.all('/:name', handleCapture);
router.all('/:name/*', handleCapture);

module.exports = router;
