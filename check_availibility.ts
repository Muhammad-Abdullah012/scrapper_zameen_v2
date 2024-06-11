import axios, { AxiosError } from "axios";
import { pool, logger as mainLogger } from "./config";

const logger = mainLogger.child({ file: "check_availibility" });

(async () => {
  let offset = 0;
  const batchSize = 100;
  while (true) {
    logger.info("offset ==> " + offset);
    const result = await pool.query(
      `SELECT url FROM property_v2 WHERE available = TRUE LIMIT $1 OFFSET $2;`,
      [batchSize, offset]
    );
    offset += batchSize;
    if (result.rowCount == null || result.rowCount === 0) break;
    const promises = await Promise.allSettled(
      result.rows.map(({ url }) => axios.get(url))
    );
    const urlsToUpdate = promises
      .map((promise) => {
        if (
          promise.status === "rejected" &&
          promise.reason instanceof AxiosError &&
          promise.reason.response?.status === 410
        )
          return promise.reason.config?.url;
      })
      .filter((url) => url != null);
    logger.info("Number of rows to update: " + urlsToUpdate.length);
    if (urlsToUpdate.length === 0) continue;
    await pool.query(
      `UPDATE property_v2 SET available = FALSE WHERE url = ANY($1)`,
      [urlsToUpdate]
    );
    logger.info("Updated rows: " + urlsToUpdate.length);
  }
})();
