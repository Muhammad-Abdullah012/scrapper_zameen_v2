import { QueryResult } from "pg";
import axios, { AxiosError } from "axios";
import { pool, logger as mainLogger } from "./config";

const logger = mainLogger.child({ file: "check_availibility" });

(async () => {
  let lastId: number | null = null;
  const batchSize = 100;
  while (true) {
    logger.info("lastId ==> " + lastId);
    const result: QueryResult<any> = await pool.query(
      `SELECT id, url FROM property_v2 WHERE available = TRUE AND id > $2 ORDER BY id ASC LIMIT $1;`,
      [batchSize, lastId ?? 0]
    );
    if (result.rowCount == null || result.rowCount === 0) break;
    lastId = result.rows[result.rowCount - 1].id;
    const promises = await Promise.allSettled(
      result.rows.map(({ url }: { url: string }) => axios.get(url))
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
