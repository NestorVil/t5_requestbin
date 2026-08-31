const crypto = require('crypto');
const db = require('../db/postgres');

function generateSessionId() {
  // 32 random bytes -> 64 hex characters, matching the sessions.id CHECK constraint
  return crypto.randomBytes(32).toString('hex');
}

async function findSession(id) {
  const result = await db.query('SELECT id FROM sessions WHERE id = $1', [id]);
  return result.rowCount > 0 ? result.rows[0] : null;
}

async function createSession() {
  const id = generateSessionId();
  await db.query('INSERT INTO sessions (id) VALUES ($1)', [id]);
  return id;
}

async function touchSession(id) {
  await db.query('UPDATE sessions SET last_seen_at = now() WHERE id = $1', [id]);
}

module.exports = { findSession, createSession, touchSession };
