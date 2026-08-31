const db = require('../db/postgres');

const NAME_PATTERN = /^[a-z0-9]{1,32}$/;

function isValidName(name) {
  return typeof name === 'string' && NAME_PATTERN.test(name);
}

async function nameExists(name) {
  const result = await db.query('SELECT 1 FROM baskets WHERE name = $1', [name]);
  return result.rowCount > 0;
}

async function createBasket(name, sessionId) {
  const result = await db.query(
    'INSERT INTO baskets (name, session_id) VALUES ($1, $2) RETURNING id, name, created_at',
    [name, sessionId]
  );
  return result.rows[0];
}

async function getBasketByName(name) {
  const result = await db.query('SELECT id, name, session_id, created_at FROM baskets WHERE name = $1', [name]);
  return result.rowCount > 0 ? result.rows[0] : null;
}

async function listBasketsForSession(sessionId) {
  const result = await db.query(
    'SELECT id, name, created_at FROM baskets WHERE session_id = $1 ORDER BY created_at DESC',
    [sessionId]
  );
  return result.rows;
}

async function deleteBasket(id) {
  // ON DELETE CASCADE on requests.basket_id handles removing its requests.
  await db.query('DELETE FROM baskets WHERE id = $1', [id]);
}

module.exports = {
  isValidName,
  nameExists,
  createBasket,
  getBasketByName,
  listBasketsForSession,
  deleteBasket,
};
