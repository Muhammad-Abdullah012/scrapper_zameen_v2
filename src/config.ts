require("dotenv").config();
import { Pool } from "pg";
import { pino } from "pino";
import { unlink } from "fs";

unlink("logs/app.log", () => {});
export const logger = pino({
  timestamp: pino.stdTimeFunctions.isoTime
}, pino.destination("logs/app.log"));

export const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT
    ? Number(process.env.POSTGRES_PORT)
    : undefined,
});
