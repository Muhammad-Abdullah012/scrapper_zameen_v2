import { pool } from "./config";
import { IProperty_V2_Data } from "./types";

export const createTable = () => {
  pool.query(
    `CREATE TABLE IF NOT EXISTS property_v2 (
      id SERIAL PRIMARY KEY,
      "desc" TEXT,
      header TEXT,
      type VARCHAR(255),
      price double precision,
      location VARCHAR(255),
      bath VARCHAR(255),
      area VARCHAR(255),
      purpose VARCHAR(255),
      bedroom VARCHAR(255),
      added bigint DEFAULT 0,
      initial_amount VARCHAR(255) NULL,
      monthly_installment VARCHAR(255) NULL,
      remaining_installments VARCHAR(255) NULL,
      url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,
    (err, res) => {
      if (err) {
        console.error("error creating table:", err);
        return;
      }
      console.log("table created");
    }
  );
};

export const alreadyExists = async (url: string) => {
  const result = await pool.query(`SELECT * FROM property_v2 WHERE url = $1`, [
    url,
  ]);
  return result.rowCount != null && result.rowCount > 0;
};

export const insertIntoPropertyV2 = (data: IProperty_V2_Data) => {
  alreadyExists(data.url ?? "").then((exists) => {
    if (exists) {
      console.log("already exists");
      return;
    } else {
      console.log("does not exist, inserting");
      pool.query(
        `INSERT INTO property_v2 ("desc", header, type, price, location, bath, area, purpose, bedroom, added, initial_amount, monthly_installment, remaining_installments, url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          data.desc,
          data.header,
          data.type,
          data.price,
          data.location,
          data.bath,
          data.area,
          data.purpose,
          data.bedroom,
          data.added,
          data.initial_amount,
          data.monthly_installment,
          data.remaining_installments,
          data.url,
        ],
        (err, res) => {
          if (err) {
            console.error("error inserting into table:", err);
            return;
          } else {
            console.log("inserted into table");
          }
        }
      );
    }
  });
};
