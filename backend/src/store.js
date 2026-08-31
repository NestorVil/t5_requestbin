import { randomBytes } from 'node:crypto';

/**
 * In-memory store. Placeholder for the real Postgres + MongoDB layer.
 * Everything here is lost when the process restarts.
 */

const MAX_REQUESTS_PER_BIN = Number(process.env.MAX_REQUESTS_PER_BIN ?? 100);

/** URL-safe random id, ~11 chars for 8 bytes. Not the (future) DB primary key. */
const genId = (bytes = 8) => randomBytes(bytes).toString('base64url');

/** @type {Map<string, { binId: string, createdAt: string, requests: object[] }>} */
const bins = new Map();

export function createBin() {
  const binId = genId(8);
  const bin = { binId, createdAt: new Date().toISOString(), requests: [] };
  bins.set(binId, bin);
  return bin;
}

export function getBin(binId) {
  return bins.get(binId) ?? null;
}

export function deleteBin(binId) {
  return bins.delete(binId);
}

export function addRequest(binId, data) {
  const bin = bins.get(binId);
  if (!bin) return null;

  const request = {
    id: genId(9),
    receivedAt: new Date().toISOString(),
    ...data,
  };

  bin.requests.unshift(request);
  if (bin.requests.length > MAX_REQUESTS_PER_BIN) {
    bin.requests.length = MAX_REQUESTS_PER_BIN;
  }
  return request;
}

export function listRequests(binId) {
  return bins.get(binId)?.requests ?? null;
}

export function getRequest(binId, requestId) {
  return bins.get(binId)?.requests.find((r) => r.id === requestId) ?? null;
}

export function clearRequests(binId) {
  const bin = bins.get(binId);
  if (!bin) return false;
  bin.requests = [];
  return true;
}
