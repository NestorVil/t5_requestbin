// Minimal forward-only migration runner. Applies backend/migrations/*.sql in
// filename order, once each, tracked in the schema_migrations table.
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './db/pg.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  const done = new Set(rows.map((r) => r.name));

  let applied = 0;
  for (const file of files) {
    if (done.has(file)) {
      console.log(`= skip   ${file}`);
      continue;
    }
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`+ applied ${file}`);
      applied += 1;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`! failed  ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }

  await pool.end();
  console.log(applied ? `done (${applied} applied)` : 'already up to date');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
