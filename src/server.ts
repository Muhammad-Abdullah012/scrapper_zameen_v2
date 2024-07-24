import express from "express";
import { spawn } from "node:child_process";

(() => {
  spawn("pnpm", ["run", "start-cronjob"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
})();

const app = express();

app.get("/", (req, res) => {
  res.json("Server is running!");
});

app.post("/", (req, res) => {
  try {
    spawn("pnpm", ["run", "start"], {
      cwd: process.cwd(),
      stdio: "inherit",
    });
    res.json("Scraping started!");
  } catch (err) {
    if (err instanceof Error) {
      return res.json({ error: err.message });
    }
    res.json(JSON.stringify(err));
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server is running on port " + PORT);
});
