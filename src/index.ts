import puppeteer, { Browser } from "puppeteer";
import { scrapListing, scrapStoriesListings } from "./scrap_helper";
import { getUrl } from "./utils/utils";
import { logger as mainLogger } from "./config";
import { insertIntoCity, lastAdded } from "./queries";

const logger = mainLogger.child({ file: "index" });

const PROPERTY_TYPES = ["Homes", "Plots", "Commercial"];
const PROPERTY_PURPOSE = ["Buy", "Rent"];
const CITIES = ["Islamabad-3", "Karachi-2", "Lahore-1", "Rawalpindi-41"];

(async () => {
  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({ args: ["--no-sandbox"] });
    for (const city of CITIES) {
      const cityName = city.split("-")[0];
      const cityId = await insertIntoCity(cityName);
      const LAST_ADDED = await lastAdded(cityId);
      for (const propertyType of PROPERTY_TYPES) {
        for (const purpose of PROPERTY_PURPOSE) {
          const url = getUrl(propertyType, city, purpose);
          await Promise.allSettled([
            scrapListing(url, LAST_ADDED, cityId).catch((err) => {
              logger.error(`Error scraping ${url}: ${err}`);
            }),
            scrapStoriesListings(url, browser, cityId).catch((err) => {
              logger.error(`Error scraping story ${url}: ${err}`);
            }),
          ]);
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
