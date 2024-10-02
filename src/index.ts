import { config } from "dotenv";
import { AggregateError, InferCreationAttributes, Op } from "sequelize";
import { City, CityModel } from "./types/model";
import {
  getAllPromisesResults,
  getUrl,
  sendMessageToSlack,
} from "./utils/utils";
import { logger as mainLogger, pool } from "./config";
import {
  getFilteredPages,
  processInBatches,
  scrapAndInsertData,
} from "./scrap_helper";
import { lastAdded } from "./queries";
import {
  CITIES_MAP,
  PROPERTY_PURPOSE,
  PROPERTY_TYPES,
  REVERSE_CITIES_MAP,
} from "./constants";
config();
const logger = mainLogger.child({ file: "index" });

(async () => {
  try {
    console.time("Start scraping and inserting data");

    const stepsToRun = process.env.STEPS_TO_RUN
      ? process.env.STEPS_TO_RUN.split(",").map(Number)
      : [1, 2, 3];

    if (stepsToRun.includes(1)) {
      const citiesMapArray = Object.values(CITIES_MAP);
      await City.bulkCreate(
        citiesMapArray.map((name) => ({
          name,
        })) as Array<InferCreationAttributes<CityModel>>,
        {
          ignoreDuplicates: true,
          returning: ["id", "name"],
        },
      );
      const cityModels = await City.findAll({
        where: {
          name: {
            [Op.in]: citiesMapArray,
          },
        },
        attributes: ["id", "name"],
      });

      const citiesMap = {} as Record<string, number>;
      const citiesLastAddedMap = {} as Record<number, Promise<Date | null>>;

      cityModels.forEach(({ id, name }) => {
        const cityKey =
          REVERSE_CITIES_MAP[name as keyof typeof REVERSE_CITIES_MAP];
        citiesLastAddedMap[id] = lastAdded(id);
        if (cityKey) citiesMap[cityKey] = id;
      });

      const pages = Object.values(REVERSE_CITIES_MAP)
        .map((city) =>
          PROPERTY_TYPES.map((propertyType) =>
            PROPERTY_PURPOSE.map((purpose) =>
              getUrl(propertyType, city, purpose, citiesMap[city]),
            ),
          ),
        )
        .flat(2);
      logger.info(`Pages :: ${pages.length}`);
      await getAllPromisesResults(
        pages.map((p) => getFilteredPages(p, citiesLastAddedMap)),
      );

      logger.info("Urls inserted successfully");
    }

    if (stepsToRun.includes(2)) {
      logger.info("Adding data to raw_properties table");
      await processInBatches();
      logger.info(`Scraping completed successfully`);
    }

    if (stepsToRun.includes(3)) {
      logger.info("Adding data to Properties table");
      await scrapAndInsertData();
      logger.info("Data added to Properties table successfully");
    }

    await sendMessageToSlack();
  } catch (err) {
    logger.error(err);
    let errorMessage = "";
    if (err instanceof AggregateError) {
      errorMessage = err.errors.map((e) => e.message).join(", ");
    } else if (err instanceof Error) {
      errorMessage = err.message;
    } else {
      errorMessage = JSON.stringify(err);
    }
    await sendMessageToSlack(errorMessage);
  } finally {
    console.timeEnd("Start scraping and inserting data");

    await Promise.all([
      pool.query("REFRESH MATERIALIZED VIEW rankedpropertiesforsale;"),
      pool.query("REFRESH MATERIALIZED VIEW rankedpropertiesforrent;"),
      pool.query("REFRESH MATERIALIZED VIEW countpropertiesview;"),
    ]);
    console.log("Refreshed Materialized Views");
  }
})().catch((err) => {
  logger.fatal(`Unhandled error: ${err.message}, ${err}`);
  process.exit(1);
});
