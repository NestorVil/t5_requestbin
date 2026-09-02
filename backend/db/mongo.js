const MongoClient = require("mongodb").MongoClient;

let client;
let db;

async function connectMongo() {
  client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  db = client.db(process.env.MONGO_DB_NAME);
  console.log(`Connected to MongoDB (${process.env.MONGO_DB_NAME})`);
  return db;
}

const recordToBasket = async (req, res, next) => {
  const { name } = req.params;

  const requestLine = `${req.method} ${req.url} HTTP/${req.httpVersion}`;
  const headerLines = [];
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    headerLines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
  }
  const rawRequestText = [requestLine, ...headerLines, '', req.body || ''].join('\r\n');

  try {
    await db.collection('raw_requests').insertOne({
      basket: name,
      raw: rawRequestText,
      method: req.method,
      url: req.url,
      receivedAt: new Date(),
    });
  } catch (err) {
    console.error('Failed to write fallback record to Mongo', err);
  }

  next();
};

module.exports = { connectMongo, recordToBasket }
