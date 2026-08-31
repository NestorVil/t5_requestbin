require('dotenv').config();

// Parses a positive-number env var, falling back to `fallback` if it's
// missing, non-numeric, or not positive — avoids the `value || fallback`
// pitfall where a legitimately-set but falsy value (like 0) would be
// silently overridden, the same bug class we fixed in the pagination code.
function positiveNumberEnv(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

module.exports = {
  port: positiveNumberEnv('PORT', 3000),

  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017',
    dbName: process.env.MONGO_DB_NAME || 'requestbin',
  },

  postgres: {
    host: process.env.PG_HOST || 'localhost',
    port: positiveNumberEnv('PG_PORT', 5432),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: process.env.PG_DATABASE || 'requestbin',
  },

  session: {
    cookieName: process.env.SESSION_COOKIE_NAME || 'session_id',
    maxAgeMs: positiveNumberEnv('SESSION_MAX_AGE_DAYS', 30) * 24 * 60 * 60 * 1000,
  },

  cleanup: {
    // Baskets with no activity (or, if never active, whose creation) older
    // than this are eligible for automatic deletion.
    expirationMs: positiveNumberEnv('CLEANUP_EXPIRATION_DAYS', 7) * 24 * 60 * 60 * 1000,
    // How often the in-process cleanup job checks for expired baskets.
    intervalMs: positiveNumberEnv('CLEANUP_INTERVAL_HOURS', 1) * 60 * 60 * 1000,
  },

  capture: {
    // Max size of a request body accepted at /basket/:name. Express's own
    // default (100kb) is easy to exceed with real-world webhook payloads.
    bodyLimit: process.env.CAPTURE_BODY_LIMIT || '5mb',
  },

  cors: {
    // The frontend's origin, once it exists — needed so the session cookie
    // can be sent on cross-origin requests during local development (e.g.
    // a React dev server on a different port than this API).
    allowedOrigin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  },
};
