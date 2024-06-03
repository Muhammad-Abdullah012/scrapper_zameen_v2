import { scrapListing } from "./scrap_helper";
import { getUrl } from "./utils";
import { logger as mainLogger } from "./config";
import { addUpdatedAtTrigger, createTable } from "./queries";

const logger = mainLogger.child({ file: "index" });

const PROPERTY_TYPES = ["Homes", "Plots", "Commercial"];
const PROPERTY_PURPOSE = ["Buy", "Rent"];
const CITIES = ["Islamabad-3", "Karachi-2", "Lahore-1", "Rawalpindi-41"];

const initDb = () => {
  createTable().then(() => {
    addUpdatedAtTrigger("property_v2");
  });
};
(async () => {
  try {
    initDb();
    for (const city of CITIES) {
      for (const propertyType of PROPERTY_TYPES) {
        for (const purpose of PROPERTY_PURPOSE) {
          try {
            const url = getUrl(propertyType, city, purpose);
            await scrapListing(url);
          } catch (err) {
            logger.error(
              `Error scraping ${propertyType}, ${city}, ${purpose}: ${err}`
            );
          }
        }
      }
    }
  } catch (err) {
    logger.error(err);
  }
})();
