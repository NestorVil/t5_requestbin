import { randomBytes } from 'node:crypto';
import { query } from './db/pg.js';
import { rawRequests } from './db/mongo.js';

/**
 * Data access layer.
 *   Postgres  - bins + request metadata (queryable)
 *   MongoDB   - raw_requests: the untouched request payload, never lost
 * All functions are async. Signatures match what routes/*.js expect.
 */

const MAX_REQUESTS_PER_BIN = Number(process.env.MAX_REQUESTS_PER_BIN ?? 100);

/** URL-safe random id, ~12 chars for 9 bytes. Used for public request ids. */
const genId = (bytes = 9) => randomBytes(bytes).toString('base64url');

// Thrown by createBin when the bin_id already exists (Postgres unique violation).
export class BinExistsError extends Error {
  constructor(binId) {
    super(`bin "${binId}" already exists`);
    this.name = 'BinExistsError';
  }
}

export async function createBin(binId) {
  try {
    const { rows } = await query(
      `INSERT INTO bins (bin_id) VALUES ($1)
       RETURNING bin_id AS "binId", created_at AS "createdAt"`,
      [binId]
    );
    return { ...rows[0], requestCount: 0 };
  } catch (err) {
    if (err.code === '23505') throw new BinExistsError(binId); // unique_violation
    throw err;
  }
}

export async function getBin(binId) {
  const { rows } = await query(
    `SELECT b.bin_id AS "binId",
            b.created_at AS "createdAt",
            (SELECT count(*)::int FROM requests r WHERE r.bin_id = b.id) AS "requestCount"
       FROM bins b
      WHERE b.bin_id = $1`,
    [binId]
  );
  return rows[0] ?? null;
}

export async function deleteBin(binId) {
  const { rows } = await query(
    'DELETE FROM bins WHERE bin_id = $1 RETURNING id',
    [binId]
  );
  if (rows.length === 0) return false;
  await rawRequests().deleteMany({ binId });
  return true;
}

export async function addRequest(binId, data) {
  const bin = await query('SELECT id FROM bins WHERE bin_id = $1', [binId]);
  if (bin.rows.length === 0) return null;
  const binPk = bin.rows[0].id;

  const requestId = genId();
  const receivedAt = new Date();

  // 1. raw payload -> Mongo (source of truth for the body)
  const mongoDoc = await rawRequests().insertOne({
    requestId,
    binId,
    method: data.method,
    url: data.url ?? data.path,
    headers: data.headers,
    query: data.query,
    rawBody: data.body ?? '',
    bodyEncoding: 'utf8',
    receivedAt,
  });

  // 2. metadata -> Postgres
  const { rows } = await query(
    `INSERT INTO requests
       (request_id, bin_id, method, path, query, headers, content_type, body_size, mongo_doc_id, remote_ip, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11)
     RETURNING request_id AS "id", created_at AS "receivedAt"`,
    [
      requestId,
      binPk,
      data.method,
      data.path,
      JSON.stringify(data.query ?? {}),
      JSON.stringify(data.headers ?? {}),
      data.contentType ?? null,
      data.bodySize ?? 0,
      String(mongoDoc.insertedId),
      data.remoteIp ?? null,
      receivedAt,
    ]
  );

  await query('UPDATE bins SET last_activity_at = now() WHERE id = $1', [binPk]);

  // 3. keep only the newest MAX_REQUESTS_PER_BIN rows for this bin
  await query(
    `DELETE FROM requests
      WHERE bin_id = $1
        AND id NOT IN (
          SELECT id FROM requests WHERE bin_id = $1
          ORDER BY created_at DESC LIMIT $2
        )`,
    [binPk, MAX_REQUESTS_PER_BIN]
  );

  return {
    id: rows[0].id,
    receivedAt: rows[0].receivedAt,
    method: data.method,
    path: data.path,
    query: data.query ?? {},
    headers: data.headers ?? {},
    contentType: data.contentType ?? null,
    bodySize: data.bodySize ?? 0,
    body: data.body ?? '',
  };
}

export async function listRequests(binId) {
  const bin = await query('SELECT id FROM bins WHERE bin_id = $1', [binId]);
  if (bin.rows.length === 0) return null;

  const { rows } = await query(
    `SELECT request_id  AS "id",
            created_at   AS "receivedAt",
            method,
            path,
            query,
            headers,
            content_type AS "contentType",
            body_size    AS "bodySize"
       FROM requests
      WHERE bin_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [bin.rows[0].id, MAX_REQUESTS_PER_BIN]
  );
  return rows;
}

export async function getRequest(binId, requestId) {
  const { rows } = await query(
    `SELECT r.request_id  AS "id",
            r.created_at   AS "receivedAt",
            r.method,
            r.path,
            r.query,
            r.headers,
            r.content_type AS "contentType",
            r.body_size    AS "bodySize"
       FROM requests r
       JOIN bins b ON b.id = r.bin_id
      WHERE b.bin_id = $1 AND r.request_id = $2`,
    [binId, requestId]
  );
  if (rows.length === 0) return null;

  const raw = await rawRequests().findOne({ requestId });
  return { ...rows[0], body: raw?.rawBody ?? '' };
}

export async function clearRequests(binId) {
  const bin = await query('SELECT id FROM bins WHERE bin_id = $1', [binId]);
  if (bin.rows.length === 0) return false;
  await query('DELETE FROM requests WHERE bin_id = $1', [bin.rows[0].id]);
  await rawRequests().deleteMany({ binId });
  return true;
}
