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
  database: "todolist",
});

app.use(cors());
app.use(express.json());

// Baskets
app.get("/api/new-basket", async (req, res) => {
  let name = generateBasketName();
  const res = await pool.query("SELECT name FROM baskets");
  const allNames = res.rows.map((row) => row.name);
  while (allNames.includes(newName)) {
    name = generateBasketName();
  }
  res.json(name);
});
app.get("/api/baskets/:name", (req, res) => {});
app.post("/api/baskets/:name", async (req, res) => {
  try {
    const newBasket = await pool.query(
      "INSERT INTO todos (description) VALUES($1) RETURNING *",
      [description]
    );
    res.json(newBin.rows[0]);
  } catch (error) {
    console.error(error.message);
  }
});
app.delete("/api/baskets/:name", (req, res) => {});

// Requests
app.get("/api/baskets/:name/requests", (req, res) => {});
app.delete("/api/baskets/:name/requests");
app.delete("/api/baskets/:name/requests/:id", (req, res) => {});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
