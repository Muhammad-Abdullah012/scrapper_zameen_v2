import puppeteer, { Browser } from "puppeteer";
import { scrapListing, scrapStoriesListings } from "./scrap_helper";
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
  let browser: Browser | null = null;
  try {
    await initDb();
    const scrapingTasks: Promise<void>[] = [];
    for (const city of CITIES) {
      const LAST_ADDED = await lastAdded(city.split("-")[0]);
      for (const propertyType of PROPERTY_TYPES) {
        for (const purpose of PROPERTY_PURPOSE) {
          const url = getUrl(propertyType, city, purpose);
          scrapingTasks.push(
            scrapListing(url, LAST_ADDED).catch((err) => {
              logger.error(`Error scraping ${url}: ${err}`);
            })
          );
        }
      }
    }
    await Promise.allSettled(scrapingTasks);
    logger.info("Scraping stories...");
    browser = await puppeteer.launch({ args: ["--no-sandbox"] });
    for (const city of CITIES) {
      for (const propertyType of PROPERTY_TYPES) {
        for (const purpose of PROPERTY_PURPOSE) {
          const url = getUrl(propertyType, city, purpose);
          try {
            await scrapStoriesListings(url, browser);
          } catch (err) {
            logger.error(`Error scraping story ${url}: ${err}`);
          }
        }
      }
    }
  } catch (err) {
    logger.error(err);
  } finally {
    if (browser) {
      browser.close();
    }
  }
})();
