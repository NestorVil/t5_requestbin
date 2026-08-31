const fs = require('fs');
const path = require('path');
const { pool } = require('./postgres');

// This project doesn't use incremental migrations — 001_init.sql always
// describes the CURRENT desired schema, not one incremental change. So
// rather than relying on CREATE TABLE IF NOT EXISTS (which silently does
// nothing if a table already exists with an outdated schema), this script
// explicitly drops everything first, then recreates it fresh. This is a
// deliberate tradeoff for a project still in early testing: every run of
// `npm run migrate` wipes all existing data, in exchange for schema
// changes always actually taking effect with one command.
async function migrate() {
  console.log('Dropping existing tables (if any)...');
  await pool.query('DROP TABLE IF EXISTS requests, baskets, sessions CASCADE;');

  const sqlPath = path.join(__dirname, 'migrations', '001_init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);

  console.log('Migration applied successfully — schema reset to match 001_init.sql');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed', err);
  process.exit(1);
});
