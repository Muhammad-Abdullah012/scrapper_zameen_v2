import { scrapeHtmlPage } from "../scrap_helper";
import { pool, logger as mainLogger } from "../config";
import { QueryResult } from "pg";
import { Feature } from "../types";

const logger = mainLogger.child({ file: "add_cover_photos" });

(async () => {
  let lastId: number | null = null;
  const batchSize = 200;
  while (true) {
    logger.info("lastId ==> " + lastId);
    const result: QueryResult<any> = await pool.query(
      `SELECT id, url FROM property_v2 WHERE features = '[]'::jsonb AND available = TRUE AND id > $2 ORDER BY id ASC LIMIT $1;`,
      [batchSize, lastId ?? 0]
    );
    if (result.rowCount == null || result.rowCount === 0) break;
    lastId = result.rows[result.rowCount - 1].id;

    const valuesMap = await Promise.allSettled(
      result.rows.map(async ({ url, id }: { url: string; id: number }) => {
        const scrapedData = await scrapeHtmlPage(url);
        return { id, features: scrapedData.features };
      })
    );
    const values = valuesMap
      .map((v) => (v.status === "fulfilled" ? v.value : null))
      .filter((v) => v != null) as { id: number; features: Feature[] }[];

    const valuesToInsert = values
      .map(
        ({ id, features }) => `(${id}, '${JSON.stringify(features)}'::jsonb)`
      )
      .join(",");
    logger.info("Number of rows to update: " + values.length);
    if (values.length === 0) continue;
    logger.info("Values to insert: " + valuesToInsert);
    await pool.query(
      `UPDATE property_v2 as p SET
        features = c.features
        from (values ${valuesToInsert}) as c(id, features) 
        where c.id = p.id;`
    );
  }
})();
