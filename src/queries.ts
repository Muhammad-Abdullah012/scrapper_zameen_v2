import { pool } from "./config";
import { IProperty_V2_Data } from "./types";
import { logger as mainLogger } from "./config";

const logger = mainLogger.child({ file: "queries" });
const PROPERTIES_TABLE_NAME = "properties";
const CITIES_TABLE_NAME = "cities";
const LOCATIONS_TABLE_NAME = "locations";

export const insertIntoCity = async (city: string) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertResult = await client.query(
      `INSERT INTO ${CITIES_TABLE_NAME} (name)
       VALUES ($1)
       ON CONFLICT (name) DO NOTHING
       RETURNING id;`,
      [city]
    );

    let cityId;
    if (insertResult.rows.length > 0) {
      cityId = insertResult.rows[0].id;
    } else {
      const selectResult = await client.query(
        `SELECT id FROM ${CITIES_TABLE_NAME} WHERE name = $1;`,
        [city]
      );
      cityId = selectResult.rows[0]?.id;
    }

    await client.query("COMMIT");
    return cityId;
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error(`error inserting into ${CITIES_TABLE_NAME}: ${error}`);
    return null;
  } finally {
    client.release();
  }
};

export const insertIntoLocation = async (location: string) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertResult = await client.query(
      `INSERT INTO ${LOCATIONS_TABLE_NAME} (name)
       VALUES ($1)
       ON CONFLICT (name) DO NOTHING
       RETURNING id;`,
      [location]
    );

    let locationId;
    if (insertResult.rows.length > 0) {
      locationId = insertResult.rows[0].id;
    } else {
      const selectResult = await client.query(
        `SELECT id FROM ${LOCATIONS_TABLE_NAME} WHERE name = $1;`,
        [location]
      );
      locationId = selectResult.rows[0]?.id;
    }

    await client.query("COMMIT");

    return locationId;
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error(`error inserting into ${LOCATIONS_TABLE_NAME}: ${error}`);
    return null;
  } finally {
    client.release();
  }
};

export const alreadyExists = async (url: string) => {
  const result = await pool.query(
    `SELECT * FROM ${PROPERTIES_TABLE_NAME} WHERE url = $1`,
    [url]
  );
  return result.rowCount != null && result.rowCount > 0;
};

export const lastAdded = async (cityId: number) => {
  try {
    const result = await pool.query(
      `SELECT added FROM ${PROPERTIES_TABLE_NAME} WHERE city_id = $1 AND added IS NOT NULL ORDER BY added DESC LIMIT 1;`,
      [cityId]
    );
    return result.rowCount != null && result.rowCount > 0
      ? result.rows[0].added
      : 0;
  } catch (error) {
    logger.error(`error getting last added: ${error}`);
    return 0;
  }
};

export const insertIntoPropertyV2 = async (
  data: IProperty_V2_Data,
  cityId: number
) => {
  try {
    const locationId = await insertIntoLocation(data.location ?? "");
    const exists = await alreadyExists(data.url ?? "");
    if (exists) {
      logger.info(data.url + " already exists in table, Updating!");
      await pool.query(
        `UPDATE ${PROPERTIES_TABLE_NAME} 
         SET "description" = $1, 
             header = $2, 
             type = $3, 
             price = $4, 
             location_id = $5, 
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
          locationId,
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
        `INSERT INTO ${PROPERTIES_TABLE_NAME} ("description", header, type, price, location_id, bath, area, purpose, bedroom, added, initial_amount, monthly_installment, remaining_installments, url, cover_photo_url, features, city_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17)`,
        [
          data.desc,
          data.header,
          data.type,
          data.price,
          locationId,
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
          cityId,
        ]
      );
    }
  } catch (err) {
    logger.error(`error while inserting or updating: ${err}`);
  }
};
