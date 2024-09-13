require("dotenv").config();
import * as cheerio from "cheerio";
import { Op } from "sequelize";
import axios from "axios";

import { insertAgency, insertIntoLocation } from "./queries";
import { logger as mainLogger } from "./config";
import { IRawProperty, Property, RawProperty, UrlModel } from "./types/model";
import {
  formatKeyValue,
  getAllPromisesResults,
  getExternalId,
  relativeTimeToTimestamp,
} from "./utils/utils";
import { Feature, IPagesData } from "./types";
import { sequelize } from "./config/sequelize";

const logger = mainLogger.child({ file: "scrap_helper" });

export const scrapeHtmlPage = async (
  url: string,
  html: string = "",
  cityId?: number,
  external_id?: number
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
    external_id,
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

export const processInBatches = async () => {
  const batchSize = 50;
  let page = 0;

  while (true) {
    const batch = await UrlModel.findAll({
      where: { is_processed: false },
      attributes: ["url", "city_id"],
      limit: batchSize,
      offset: page * batchSize,
    });

    if (batch.length === 0) break;

    const dataToInsert = await getAllPromisesResults(
      batch.map((page: any) =>
        getHtmlPage({ url: page.url, cityId: page.city_id })
      )
    );

    logger.info(`dataToInsert length => ${dataToInsert.length}`);

    const transaction = await sequelize.transaction();
    try {
      const insertedUrls = await RawProperty.bulkCreate(
        dataToInsert as IRawProperty[],
        {
          ignoreDuplicates: true,
          returning: ["url"],
          logging: false,
          transaction,
        }
      );

      await UrlModel.update(
        { is_processed: true },
        {
          where: {
            url: {
              [Op.in]: insertedUrls.map((d) => d?.url),
            },
          },
          logging: false,
          transaction,
        }
      );
      await transaction.commit();
    } catch (err) {
      logger.error(`Error inserting batch in RawProperty : ${err}`);
      await transaction.rollback();
    }
    ++page;
  }
};

export const scrapAndInsertData = async (batchSize: number) => {
  const pageSize = 50;
  let page = 0;

  while (true) {
    const rawData = await RawProperty.findAll({
      where: {
        is_processed: false,
      },
      attributes: ["url", "html", "city_id", "external_id"],
      limit: pageSize,
      offset: page * pageSize,
    });

    if (rawData.length === 0) {
      break;
    }

    const dataToInsert = await getAllPromisesResults(
      rawData.map(({ url, html, city_id, external_id }) =>
        scrapeHtmlPage(url, html, city_id, external_id)
      )
    );

    const transaction = await sequelize.transaction();
    try {
      const insertedUrls = await Property.bulkCreate(dataToInsert as any, {
        ignoreDuplicates: true,
        returning: ["url"],
        logging: false,
        transaction,
      });

      await RawProperty.update(
        { is_processed: true },
        {
          where: {
            url: {
              [Op.in]: insertedUrls.map((d) => d?.url),
            },
          },
          logging: false,
          transaction,
        }
      );
      await transaction.commit();
    } catch (err) {
      logger.error("scrapAndInsertData::Error inserting data: ", err);
      await transaction.rollback();
    }
    ++page;
  }
};
