const express = require("express");
const cors = require("cors");
const { generateBasketName } = require("./utils");
const app = express();
const PORT = 3000;

// Move this later
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

const getBasket = async (req, res) => {
  const { name } = req.params;
  const basket = await pool.query("SELECT * FROM baskets WHERE name = $1", [
    name,
  ]);
  res.json(basket.rows[0]);
};

app.get("/api/baskets/:name", getBasket);
app.post("/api/baskets/:name", async (req, res) => {
  try {
    const basket = getBasket();
    if (basket) {
      throw new Error("Basket already exists");
    }

    const sessionId = req.body.sessionId;
    const name = req.params.name;
    const totalCount = 0;
    const newBasket = await pool.query(
      "INSERT INTO baskets (session_id, total_count, name) VALUES($1, $2, $3) RETURNING *",
      [sessionId, totalCount, name]
    );
    res.json(newBasket.rows[0]);
  } catch (error) {
    console.error(error.message);
  }
});
// app.delete("/api/baskets/:name", (req, res) => {});

// Requests
// app.get("/api/baskets/:name/requests", (req, res) => {});
// app.delete("/api/baskets/:name/requests");
// app.delete("/api/baskets/:name/requests/:id", (req, res) => {});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
