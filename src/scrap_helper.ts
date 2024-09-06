require("dotenv").config();
import * as cheerio from "cheerio";
import { Op } from "sequelize";
import axios from "axios";

import { insertAgency, insertIntoLocation } from "./queries";
import { limiter, logger as mainLogger } from "./config";
import { IRawProperty, Property, RawProperty } from "./types/model";
import {
  formatKeyValue,
  getAllPromisesResults,
  getExternalId,
  relativeTimeToTimestamp,
} from "./utils/utils";
import { Feature, IPagesData } from "./types";

const logger = mainLogger.child({ file: "scrap_helper" });

export const scrapeHtmlPage = async (
  url: string,
  html: string = "",
  cityId?: number
) => {
  if (!html.length) return {};
  const $ = cheerio.load(html);

  const header = $("h1").text();
  const location = $('div[aria-label="Property header" i]').text();
  const description = $('div[aria-label="Property description text" i]').text();
  const coverPhotoUrl = $('img[aria-label="Cover Photo" i]').attr("src");
  const agencyInfo = $('div[aria-label="Agency info" i]');
  const agencyProfileLink = agencyInfo.find("a").filter(function () {
    return $(this).text().trim().toLowerCase() === "view agency profile";
  });

  const agencyIdPromise = insertAgency({
    title: agencyProfileLink.attr("title"),
    profileUrl: agencyProfileLink.attr("href"),
  });

  const locationIdPromise = insertIntoLocation(location);

  const keyValue: { [key: string]: any } = {
    header,
    description,
    url,
    city_id: cityId,
    cover_photo_url: coverPhotoUrl,
    is_posted_by_agency: agencyInfo.length > 0,
  };
  $('ul[aria-label="Property details" i] li').each(function (i, elem) {
    const spans = $(this)
      .children("span")
      .filter(function () {
        return $(this).text().trim() !== "";
      });
    const key = $(spans[0]).text();
    const value = spans
      .slice(1)
      .map(function () {
        return $(this).text();
      })
      .get()
      .join(" ");
    // const key = $(this).find("span._3af7fa95").text();
    // const value = $(this).find("span._812aa185").text();
    const lowerCaseKey = key.split("(")[0].toLowerCase().replace(/\s+/g, "_");
    keyValue[lowerCaseKey] = formatKeyValue(lowerCaseKey, value);
  });

  const $amenities = $("div[id='amenities-scrollable']");
  const features: Feature[] = [];

  $($amenities)
    .find("div._040e4f65")
    .each(function (_, element) {
      const category = $(element).find("div.f5c4d39a").text().trim();
      const featureList: string[] = [];

      $(element)
        .find("div.ef6b6a44 > div.c3b151ea")
        .each((_, featureElement) => {
          const feature = $(featureElement).find("div.e2a20506").text().trim();
          featureList.push(feature);
        });

      features.push({ category, features: featureList });
    });
  keyValue["features"] = features;
  const [locationId, agencyId] = await Promise.all([
    locationIdPromise,
    agencyIdPromise,
  ]);
  keyValue["location_id"] = locationId;
  keyValue["agency_id"] = agencyId;
  return keyValue;
};

const processPage = async (
  link: string,
  cityId: number,
  lastAddedDbPromise: Promise<any>
) => {
  logger.info("onPage ==> " + link);
  const mainPage = await axios.get(link);
  const $ = cheerio.load(mainPage.data);
  const listings = $('li[aria-label="Listing"][role="article"]');
  let shouldStopLoop = false;
  const lastDateInDb = await lastAddedDbPromise;

  const listingLinks = listings
    .map((_index, element) => {
      const li = $(element);

      const listingLink = li.find('a[aria-label="Listing link"]').attr("href");

      const creationDateSpan = li.find(
        'span[aria-label="Listing creation date"]'
      );

      const creationDate = creationDateSpan
        .text()
        .trim()
        .split(":")
        .pop()
        ?.trim();

      if (!creationDate) {
        logger.error(`Creation date not found for ${listingLink}`);
        return null;
      }

      const dateStr = relativeTimeToTimestamp(creationDate);

      if (!dateStr) {
        logger.error(
          `Could not convert date for ${listingLink}, date was: ${creationDate}`
        );
        return null;
      }
      const date = new Date(dateStr);
      const dbDate = new Date(lastDateInDb);

      if (dbDate >= date) {
        shouldStopLoop = true;
      }
      return dbDate < date
        ? {
            url: `${process.env.BASE_URL}${listingLink ?? ""}`,
            cityId,
          }
        : null;
    })
    .get()
    .filter((v) => v != null);
  logger.info(`filtered listing links ==> ${listingLinks.length}`);
  return { listingLinks, shouldStopLoop };
};

export const getHtmlPage = async (page: IPagesData) => {
  try {
    logger.info(`getting html at: ${page.url}`);
    const result = await axios.get(page.url);
    const $ = cheerio.load(result.data);
    $("script").remove();
    $("style").remove();
    $("link").remove();
    $("meta").remove();
    $("svg").remove();
    $("br").replaceWith("\n");
    return {
      url: page.url,
      city_id: page.cityId,
      html: $.html(),
      external_id: getExternalId(page.url),
    };
  } catch (error) {
    logger.error(`getHtmlPage::Error scraping ${page.url}: ${error}`);
    return null;
  }
};

export const getFilteredPages = async (
  page: IPagesData,
  cityLastAddedMap: Record<number, Promise<any>>
) => {
  const newPages: IPagesData[] = [];
  for (let i = 1; i <= 50; ++i) {
    logger.info(`fetchDataForIndex at index :: ${i}, ${page.cityId}`);
    const url = page.url.replace("*", i.toString());
    const { listingLinks, shouldStopLoop } = await processPage(
      url,
      page.cityId,
      cityLastAddedMap[page.cityId]
    );
    newPages.push(...listingLinks);
    if (shouldStopLoop) break;
  }

  return newPages.reverse();
};

export const processInBatches = async (pages: Promise<IPagesData[]>[]) => {
  console.time("filtering urls...");
  const filteredPages = await getAllPromisesResults(pages);
  console.timeEnd("filtering urls...");

  logger.info(`filteredPages length => ${filteredPages.length}`);
  const promises = filteredPages.map(async (pages) => {
    logger.info(`total urls to fetch => ${pages.length}`);
    const batchSize = 100;

    for (let i = 0; i < pages.length; i += batchSize) {
      const batch = pages.slice(i, i + batchSize);
      const dataToInsert = await getAllPromisesResults(
        batch.map((page) => limiter.schedule(() => getHtmlPage(page)))
      );

      logger.info(`dataToInsert length => ${dataToInsert.length}`);

      try {
        await RawProperty.bulkCreate(dataToInsert as IRawProperty[], {
          ignoreDuplicates: true,
          returning: false,
        });
      } catch (err) {
        logger.error(`Error inserting batch in RawProperty : ${err}`);
      }
    }
  });
  return Promise.allSettled(promises);
};

export const scrapAndInsertData = async (batchSize: number) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rawData = await RawProperty.findAll({
    where: {
      created_at: {
        [Op.gte]: today,
      },
    },
    attributes: ["url", "html", "city_id"],
  });
  for (let i = 0; i < rawData.length; i += batchSize) {
    const dataToInsert = await getAllPromisesResults(
      rawData
        .slice(i, i + batchSize)
        .map(({ url, html, city_id }) => scrapeHtmlPage(url, html, city_id))
    );

    try {
      await Property.bulkCreate(dataToInsert as any, {
        ignoreDuplicates: true,
        returning: false,
      });
    } catch (err) {
      logger.error(
        `Error inserting batch in Property ${i + 1}-${i + batchSize}: ${err}`
      );
    }
  }
};
