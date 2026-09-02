const express = require("express");
const session = require("express-session");
const cors = require("cors");
const http = require("http");
const pgSession = require("connect-pg-simple")(session);
const { generateBasketName } = require("./utils");
const { Server } = require("socket.io");
const { Socket } = require("engine.io");

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// Move this later if needed
const Pool = require("pg").Pool;
const pool = new Pool({
  user: "postgres",
  password: process.env.POSTGRES_PASSWORD,
  host: "localhost",
  port: 5432,
  database: "request_basket",
});

app.use(cors());
app.use(express.json());
app.use(
  session({
    store: new pgSession({
      pool,
      tableName: "sessions",
    }),
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
  },
});

io.on("connection", (socket) => {
  console.log("Frontend connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Frontend disconnected");
  });
});

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

app.get("/api/baskets/:name", async (req, res) => {
  const name = req.params.name;
  res.json(getBasket(name));
});

app.get("/api/baskets", async (req, res) => {
  const sessionID = req.sessionID;
  const allBaskets = await pool.query(
    "SELECT name from baskets WHERE baskets.session_id = $1",
    [sessionID]
  );
  res.json(allBaskets.rows);
});

app.post("/api/baskets/:name", async (req, res) => {
  try {
    const name = req.params.name;
    const basket = await getBasket(name);
    if (basket) {
      return res.status(409).json({ message: "Basket already exists" });
    }

    const sessionID = req.sessionID;
    const idInDB = await pool.query("SELECT * FROM sessions WHERE sid = $1", [
      sessionID,
    ]);

    if (!idInDB.rows[0]) {
      await pool.query("INSERT INTO sessions (sid) VALUES ($1)", [sessionID]);
    }

    const newBasket = await pool.query(
      "INSERT INTO baskets (session_id, name) VALUES($1, $2) RETURNING *",
      [sessionID, name]
    );
    res.json(newBasket.rows[0]);
  } catch (error) {
    console.error(error.message);
  }
});
// app.delete("/api/baskets/:name", (req, res) => {});

// Requests
app.get("/api/baskets/:name/requests", async (req, res) => {
  const { name } = req.params;
  const request = await pool.query(
    `SELECT *
     FROM baskets 
     JOIN http_requests 
     ON baskets.id = http_requests.basket_id
     WHERE baskets.name = $1;
    `,
    [name]
  );
  res.json(request.rows);
});

app.all("/:name", async (req, res) => {
  const { name } = req.params;

  const basket = await getBasket(name);

  if (!basket) {
    return res.status(404).json({
      message: "Basket not found",
    });
  }

  const result = await pool.query(
    `INSERT INTO http_requests (basket_id, method, headers, body)
     VALUES ($1, $2, $3, $4) 
     RETURNING *`,
    [
      basket.id,
      req.method,
      JSON.stringify(req.headers),
      JSON.stringify(req.body),
    ]
  );

  const newRequest = result.rows[0];
  io.emit("webhook-update", newRequest);

  res.status(200).json({
    message: "Webhook received",
  });
});

app.all("/:name/*path", async (req, res) => {
  const { name } = req.params;

  const basket = await getBasket(name);

  if (!basket) {
    return res.status(404).json({
      message: "Basket not found",
    });
  }

  const result = await pool.query(
    `INSERT INTO http_requests (basket_id, method, headers, body)
     VALUES ($1, $2, $3, $4) 
     RETURNING *`,
    [
      basket.id,
      req.method,
      JSON.stringify(req.headers),
      JSON.stringify(req.body),
    ]
  );

  const newRequest = result.rows[0];
  io.emit("webhook-update", newRequest);

  res.status(200).json({
    message: "Webhook received",
  });
});


// app.delete("/api/baskets/:name/requests");
// app.delete("/api/baskets/:name/requests/:id", (req, res) => {});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
