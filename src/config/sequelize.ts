import { config } from "dotenv";
import { Sequelize } from "sequelize";

config();
const {
  POSTGRES_DB,
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  POSTGRES_PORT,
  POSTGRES_HOST,
} = process.env;

const port = Number(POSTGRES_PORT);

export const sequelize = new Sequelize({
  dialect: "postgres",
  database: POSTGRES_DB,
  username: POSTGRES_USER,
  password: POSTGRES_PASSWORD,
  port: port,
  host: POSTGRES_HOST,
  pool: {
    min: 0,
    max: 2,
    idle: 1000,
    acquire: 10000,
  },
});
