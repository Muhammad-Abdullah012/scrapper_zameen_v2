import { pool } from "./config";
import { IProperty_V2_Data } from "./types";
import { logger as mainLogger } from "./config";

const logger = mainLogger.child({ file: "queries" });

export const addUpdatedAtTrigger = (tableName: string) => {
  pool.query(
    `CREATE OR REPLACE FUNCTION update_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;`,
    (err, res) => {
      if (err) {
        logger.error(`error creating trigger: ${err}`);
        return;
      }
      pool.query(
        `CREATE OR REPLACE TRIGGER update_table_trigger BEFORE
      UPDATE ON ${tableName} FOR EACH ROW
      EXECUTE PROCEDURE update_updated_at ();`,
        (err, res) => {
          if (err) {
            logger.error(`error creating trigger: ${err}`);
            return;
          }
          logger.debug(`trigger created for table ${tableName}`);
        }
      );
    }
  );
};
export const createTable = async () => {
  try {
    await pool.query(
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
        cover_photo_url TEXT,
        available BOOLEAN DEFAULT TRUE,
        features JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
    );
    logger.debug("table created!");
  } catch (err) {
    logger.error(`error creating table: ${err}`);
  }
};

export const alreadyExists = async (url: string) => {
  const result = await pool.query(`SELECT * FROM property_v2 WHERE url = $1`, [
    url,
  ]);
  return result.rowCount != null && result.rowCount > 0;
};

export const lastAdded = async (city: string) => {
  try {
    const result = await pool.query(
      `SELECT added FROM property_v2 WHERE location ILIKE $1 ORDER BY added DESC LIMIT 1;`,
      [`%${city}%`]
    );
    return result.rowCount != null && result.rowCount > 0
      ? result.rows[0].added
      : 0;
  } catch (error) {
    logger.error(`error getting last added: ${error}`);
    return 0;
  }
};

export const insertIntoPropertyV2 = async (data: IProperty_V2_Data) => {
  try {
    const exists = await alreadyExists(data.url ?? "");
    if (exists) {
      logger.info(data.url + " already exists in table, Updating!");
      await pool.query(
        `UPDATE property_v2 
         SET "desc" = $1, 
             header = $2, 
             type = $3, 
             price = $4, 
             location = $5, 
             bath = $6, 
             area = $7, 
             purpose = $8, 
             bedroom = $9,
             initial_amount = $10, 
             monthly_installment = $11, 
             remaining_installments = $12,
             added = $13,
             cover_photo_url = $15,
             features = $16::jsonb
         WHERE url = $14`,
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
          data.initial_amount,
          data.monthly_installment,
          data.remaining_installments,
          data.added,
          data.url,
          data.coverPhotoUrl,
          JSON.stringify(data.features),
        ]
      );
    } else {
      logger.debug(data.url + " does not exist in table, inserting!");
      await pool.query(
        `INSERT INTO property_v2 ("desc", header, type, price, location, bath, area, purpose, bedroom, added, initial_amount, monthly_installment, remaining_installments, url, cover_photo_url, features) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb)`,
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
          data.coverPhotoUrl,
          JSON.stringify(data.features),
        ]
      );
    }
  } catch (err) {
    logger.error(`error while inserting or updating: ${err}`);
  }
};
