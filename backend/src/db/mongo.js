import { MongoClient } from 'mongodb';

const url = process.env.MONGO_URL ?? 'mongodb://localhost:27017';
const dbName = process.env.MONGO_DB ?? 'requestbin';

const client = new MongoClient(url);
let db = null;

export async function connectMongo() {
  if (!db) {
    await client.connect();
    db = client.db(dbName);
  }
  return db;
}

/** The collection holding untouched request payloads. */
export function rawRequests() {
  if (!db) throw new Error('Mongo not connected - call connectMongo() first');
  return db.collection('raw_requests');
}

export async function closeMongo() {
  await client.close();
  db = null;
}
