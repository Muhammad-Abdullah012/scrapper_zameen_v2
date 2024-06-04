import { scrapListing } from "./scrap_helper";
import { getUrl } from "./utils";
import { logger as mainLogger } from "./config";
import { addUpdatedAtTrigger, createTable, lastAdded } from "./queries";

const logger = mainLogger.child({ file: "index" });

const PROPERTY_TYPES = ["Homes", "Plots", "Commercial"];
const PROPERTY_PURPOSE = ["Buy", "Rent"];
const CITIES = ["Islamabad-3", "Karachi-2", "Lahore-1", "Rawalpindi-41"];

const initDb = async () => {
  await createTable();
  addUpdatedAtTrigger("property_v2");
};
(async () => {
  try {
    await initDb();
    const LAST_ADDED = await lastAdded();
    const scrapingTasks: Promise<void>[] = [];
    for (const city of CITIES) {
      for (const propertyType of PROPERTY_TYPES) {
        for (const purpose of PROPERTY_PURPOSE) {
          scrapingTasks.push(
            scrapListing(getUrl(propertyType, city, purpose), LAST_ADDED).catch(
              (err) => {
                logger.error(
                  `Error scraping ${propertyType}, ${city}, ${purpose}: ${err}`
                );
              }
            )
          );
        }
      }
    }
    await Promise.allSettled(scrapingTasks);
  } catch (err) {
    logger.error(err);
  }
})();
