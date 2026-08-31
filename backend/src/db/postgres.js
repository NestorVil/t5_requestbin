const { Pool } = require('pg');
const config = require('../config/env');

// A Pool manages a set of reusable client connections instead of opening
// a new one per query — the standard way to use `pg` in an app that
// handles concurrent requests.
const pool = new Pool(config.postgres);

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error', err);
});

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
