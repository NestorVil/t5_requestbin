import pg from 'pg';

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ??
  'postgres://requestbin:requestbin@localhost:5433/requestbin';

export const pool = new Pool({ connectionString });

export function query(text, params) {
  return pool.query(text, params);
}

export async function closePg() {
  await pool.end();
}
