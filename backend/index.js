const express = require("express");
const cron = require("node-cron");
const cors = require("cors");
const http = require("http");
const { generateBasketName } = require("./utils");
const { Server } = require("socket.io");
const { Socket } = require("engine.io");

const crypto = require("node:crypto");
const hashToken = (t) => crypto.createHash("sha256").update(t).digest("hex");
const bearerToken = (req) => {
  const m = (req.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
};

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Move this later if needed
const Pool = require("pg").Pool;
const pool = new Pool({
  user: "postgres",
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.DB_HOST || "localhost",
  port: 5432,
  database: "request_basket",
});

const connectMongo = require('./db/mongo').connectMongo;
const recordToBasket = require('./db/mongo').recordToBasket;
let mongoDb;
connectMongo()
  .then((db) => {
    mongoDb = db;
  })
  .catch((error) => {
    console.log(error);  // How do we want to handle failure to connect to Mongo? Fuggedaboudit!
  })

app.use(cors());

const requestHandler = async(req, res) => {
  const { name } = req.params;
  const path = req.path;

  const basket = await getBasket(name);

  if (!basket) {
    return res.status(404).json({
      message: "Basket not found",
    });
  }

  let parsedBody;
  try {
    parsedBody = JSON.parse(req.body);
  } catch {
    parsedBody = req.body; // body is not JSON, store as is
  }

  const result = await pool.query(
    `INSERT INTO http_requests (basket_id, method, headers, body, path)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      basket.id,
      req.method,
      JSON.stringify(req.headers),
      JSON.stringify(parsedBody),
      path,
    ]
  );

  const newRequest = result.rows[0];
  io.emit("webhook-update", { basketName: name});

  res.status(200).json({
    message: "Webhook received",
  });
}

app.all("/basket/:name", express.text({ type: '*/*' }), recordToBasket, requestHandler);
app.all("/basket/:name/*path", express.text({ type: '*/*' }), recordToBasket, requestHandler);

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  },
});

io.on("connection", (socket) => {
  console.log("Frontend connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Frontend disconnected");
  });
});

function deleteExpiredBasketsJob() {
  cron.schedule("*/20 * * * * *", async () => {
    try {
      const result = await pool.query(`
        DELETE FROM baskets
        WHERE expires_at <= NOW()
        RETURNING *
      `);

      io.emit("cron-delete", result.rows);
      console.log(`Deleted ${result.rowCount} expired basket(s)`);
    } catch (error) {
      console.error("Failed to delete expired baskets:", error);
    }
  });
}

// Baskets
app.get("/api/new-basket", async (req, res) => {
  let name = generateBasketName();
  const query = await pool.query("SELECT name FROM baskets");
  const allNames = query.rows.map((row) => row.name);
  while (allNames.includes(name)) {
    name = generateBasketName();
  }
  res.json(name);
});

const getBasket = async (name) => {
  const basket = await pool.query("SELECT * FROM baskets WHERE name = $1", [
    name,
  ]);
  return basket.rows[0];
};

async function requireBasketToken(req, res, next) {
  const basket = await getBasket(req.params.name);
  if (!basket) return res.status(404).json({message: "Basket not found"});

  const token = bearerToken(req);
  const provided = token ? Buffer.from(hashToken(token), "hex") : null;
  const expected = Buffer.from(basket.token_hash, "hex");
  const ok = provided && provided.length === expected.length &&
              crypto.timingSafeEqual(provided, expected);

  if (!ok) {
    return res.status(403).json({ message: "Invalid or missing basket token"});
  }

  req.basket = basket;
  next();
}

app.get("/api/baskets/:name", requireBasketToken, async (req, res) => {
  const {id, name, expires_at } = req.basket;
  res.json({id, name, expires_at});
});

// app.get("/api/baskets", async (req, res) => {
//   const sessionID = req.sessionID;
//   const allBaskets = await pool.query(
//     "SELECT name from baskets WHERE baskets.session_id = $1",
//     [sessionID]
//   );
//   res.json(allBaskets.rows);
// });

app.post("/api/baskets/:name", async (req, res) => {
  try {
    const name = req.params.name;
    const basket = await getBasket(name);

    if (basket) {
      return res.status(409).json({ message: "Basket already exists" });
    }

    const token = crypto.randomBytes(32).toString("base64url");

    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const newBasket = await pool.query(
      "INSERT INTO baskets (token_hash, name, expires_at) VALUES($1, $2, $3) RETURNING *",
      [hashToken(token), name, expires_at],
    );
    res.json({ ...newBasket.rows[0], token});
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Could not create basket"});
  }
});


// Requests
app.get("/api/baskets/:name/requests", requireBasketToken, async (req, res) => {
  const result = await pool.query(
    `SELECT *
     FROM http_requests
     WHERE basket_id = $1
     ORDER BY received_at DESC;
    `,
    [req.basket.id]
  );
  res.json(result.rows);
});

app.delete("/api/baskets/:name", requireBasketToken, async (req, res) => {
  await pool.query("DELETE FROM baskets WHERE id = $1", [req.basket.id]);
  res.status(204).end()
})

deleteExpiredBasketsJob();

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});