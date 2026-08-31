const mongo = require('../db/mongo');
const db = require('../db/postgres');
const wsService = require('./wsService');
const { buildRawHttpText } = require('../utils/buildRawHttpText');

async function captureRequest(basketId, req, path) {
  const receivedAt = new Date();
  const rawHttpText = buildRawHttpText(req);

  // 1. Write the full raw text to MongoDB FIRST — Postgres's `requests`
  // row needs the resulting document id (mongo_raw_id) at insert time,
  // so this write has to happen before the Postgres write, not after.
  const mongoDb = mongo.getDb();
  const mongoResult = await mongoDb.collection('raw_requests').insertOne({
    basketId,
    rawHttpText,
    receivedAt,
  });

  // 2. Parsed/structured fields -> PostgreSQL, including a pointer back
  // to the Mongo backup document.
  const contentType = req.headers['content-type'] || null;
  const body = typeof req.body === 'string' ? req.body : null;

  const insertResult = await db.query(
    `INSERT INTO requests (basket_id, method, path, headers, content_type, body, mongo_raw_id, received_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, basket_id, method, path, headers, content_type, body, mongo_raw_id, received_at`,
    [
      basketId,
      req.method,
      path,
      JSON.stringify(req.headers),
      contentType,
      body,
      mongoResult.insertedId.toString(),
      receivedAt,
    ]
  );

  const record = insertResult.rows[0];

  // 3. Notify anyone watching this basket live, over WebSocket
  wsService.broadcast(basketId, record);

  return record;
}

module.exports = { captureRequest };
