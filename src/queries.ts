import { pool } from "./config";
import { IinsertIntoAgencyProps, IProperty_V2_Data } from "./types";
import { logger as mainLogger } from "./config";
import { PoolClient } from "pg";
import { getExternalId } from "./utils/utils";

const logger = mainLogger.child({ file: "queries" });
const PROPERTIES_TABLE_NAME = "properties";
const CITIES_TABLE_NAME = "cities";
const LOCATIONS_TABLE_NAME = "locations";
const AGENCY_TABLE_NAME = "agencies";

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

export const alreadyExists = async (externalId: number | null) => {
  if (externalId == null) return false;
  const result = await pool.query(
    `SELECT * FROM ${PROPERTIES_TABLE_NAME} WHERE external_id = $1`,
    [externalId]
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

export const insertAgency = async ({
  title: agencyName,
  profileUrl,
}: IinsertIntoAgencyProps) => {
  if (!agencyName || !profileUrl) return null;
  const agencyProfileUrl = `${process.env.BASE_URL}${profileUrl}`;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO ${AGENCY_TABLE_NAME} (title, profile_url)
       VALUES ($1, $2)
       ON CONFLICT (profile_url) DO NOTHING
       RETURNING id;`,
      [agencyName, agencyProfileUrl]
    );

    const agencyId =
      rows.length > 0
        ? rows[0].id
        : await getAgencyId(client, agencyProfileUrl);

    await client.query("COMMIT");
    return agencyId;
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error(`Error inserting into ${AGENCY_TABLE_NAME}: ${error}`);
    return null;
  } finally {
    client.release();
  }
};

const getAgencyId = async (client: PoolClient, agencyProfileUrl: string) => {
  const { rows } = await client.query(
    `SELECT id FROM ${AGENCY_TABLE_NAME} WHERE profile_url = $1;`,
    [agencyProfileUrl]
  );
  return rows[0]?.id;
};

export const insertIntoPropertyV2 = async (
  data: IProperty_V2_Data,
  cityId: number,
  externalId: number | null
) => {
  try {
    const locationId = await insertIntoLocation(data.location ?? "");

    logger.info(data.url + " does not exist in table, inserting!");
    await pool.query(
      `INSERT INTO ${PROPERTIES_TABLE_NAME} ("description", header, type, price, location_id, bath, area, purpose, bedroom, added, initial_amount, monthly_installment, remaining_installments, url, cover_photo_url, features, city_id, is_posted_by_agency, agency_id, external_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17, $18, $19, $20)`,
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
        data.isPostedByAgency,
        data.agency_id,
        externalId,
      ]
    );
  } catch (err) {
    logger.error(`error while inserting or updating: ${err}`);
  }
};
