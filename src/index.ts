import { Op } from "sequelize";
import { City } from "./types/model";
import { getUrl } from "./utils/utils";
import { logger as mainLogger } from "./config";
import {
  getFilteredPages,
  processInBatches,
  scrapAndInsertData,
} from "./scrap_helper";
import { lastAdded } from "./queries";

const logger = mainLogger.child({ file: "index" });

const PROPERTY_TYPES = ["Homes", "Plots", "Commercial"];
const PROPERTY_PURPOSE = ["Buy", "Rent"];
const CITIES = ["Islamabad-3", "Karachi-2", "Lahore-1", "Rawalpindi-41"];

const BATCH_SIZE = 20;

(async () => {
  try {
    console.time("Start scraping and inserting data");
    {
      const cityModels = await City.findAll({
        where: {
          name: {
            [Op.in]: CITIES.map((c) => c.split("-")[0]),
          },
        },
        attributes: ["id", "name"],
      });

      const citiesMap = cityModels.reduce((acc, city) => {
        const cityKey = CITIES.find((c) => c.startsWith(city.name));
        if (cityKey) {
          acc[cityKey] = city.id;
        }
        return acc;
      }, {} as Record<string, number>);

      const citiesLastAddedMap = cityModels.reduce((acc, city) => {
        acc[city.id] = lastAdded(city.id);
        return acc;
      }, {} as Record<number, Promise<any>>);

      const pages = CITIES.map((city) =>
        PROPERTY_TYPES.map((propertyType) =>
          PROPERTY_PURPOSE.map((purpose) =>
            getUrl(propertyType, city, purpose, citiesMap[city])
          )
        )
      ).flat(2);
      logger.info(`Pages :: ${pages.length}`);
      await processInBatches(
        pages.map((p) => getFilteredPages(p, citiesLastAddedMap))
      );

      logger.info(`Scraping completed successfully`);
    }
    logger.info("Adding data to Properties table");
    await scrapAndInsertData(BATCH_SIZE);
    logger.info("Data added to Properties table successfully");
  } catch (err) {
    logger.fatal(err);
    process.exit(1);
  } finally {
    console.timeEnd("Start scraping and inserting data");
  }
})();
