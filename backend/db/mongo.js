const MongoClient = require("mongodb").MongoClient;

async function connectMongo() {
  let client;
  let db;

  client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  db = client.db(process.env.MONGO_DB_NAME);
  console.log(`Connected to MongoDB (${process.env.MONGO_DB_NAME})`);
  return db;
}

module.exports = { connectMongo }