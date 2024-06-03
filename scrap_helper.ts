import * as cheerio from "cheerio";
import axios from "axios";
import { insertIntoPropertyV2 } from "./queries";
import { formatPrice, relativeTimeToTimestamp } from "./utils";
import { logger as mainLogger } from "./config";
require("dotenv").config();
const logger = mainLogger.child({ file: "scrap_helper" });

export const scrapeHtmlPage = async (url: string) => {
  logger.info(`scraping ${url}`);
  const result = await axios.get(url);
  const $ = cheerio.load(result.data);
  $("style").remove();

  const header = $("h1")
    .text()
    .concat("\n")
    .concat($('div[aria-label="Property header" i]').text());

  const description = $('div[aria-label="Property description text" i]').text();
  const keyValue: { [key: string]: any } = {
    header,
    desc: description,
    url,
  };
  $('ul[aria-label="Property details" i] li').each(function (i, elem) {
    const key = $(this).find("span._3af7fa95").text();
    const value = $(this).find("span._812aa185").text();
    if (key.toLowerCase() === "price") {
      keyValue[key.toLowerCase()] = formatPrice(value);
    } else if (key.toLowerCase() === "added") {
      keyValue[key.toLowerCase()] = relativeTimeToTimestamp(value);
    } else {
      keyValue[key.split("(")[0].toLowerCase().replace(/\s+/g, "_")] = value;
    }
  });

  return keyValue;
};

export const scrapListing = async (url: string) => {
  let nextLink: string | null = url;
  do {
    try {
      logger.info("onPage ==> " + nextLink);
      const mainPage = await axios.get(nextLink);
      const $ = cheerio.load(mainPage.data);
      const promises = $('a[aria-label="Listing link"]')
        .map(async function () {
          return scrapeHtmlPage(
            `${process.env.BASE_URL}${$(this).attr("href") ?? ""}`
          );
        })
        .get();
      const data = await Promise.allSettled(promises);
      await Promise.allSettled(
        data.map((result) => {
          if (result.status === "fulfilled") {
            return insertIntoPropertyV2(result.value);
          } else {
            logger.error(`Error scraping ${nextLink}: ${result.reason}`);
            return null;
          }
        })
      );
      nextLink = $('a[title="Next"]').attr("href") || null;
      if (nextLink) {
        nextLink = `${process.env.BASE_URL}${nextLink}`;
      }
    } catch (error) {
      logger.error(`Error scraping ${nextLink}: ${error}`);
    }
  } while (nextLink != null);
};
