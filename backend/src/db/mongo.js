const { MongoClient } = require('mongodb');
const config = require('../config/env');

let client;
let db;

async function connectMongo() {
  if (db) return db;

  client = new MongoClient(config.mongo.uri);
  await client.connect();
  db = client.db(config.mongo.dbName);
  console.log(`Connected to MongoDB (${config.mongo.dbName})`);
  return db;
}

function getDb() {
  if (!db) {
    throw new Error('MongoDB not connected yet — call connectMongo() during startup first');
  }
  return db;
}

async function closeMongo() {
  if (client) await client.close();
}

module.exports = { connectMongo, getDb, closeMongo };
