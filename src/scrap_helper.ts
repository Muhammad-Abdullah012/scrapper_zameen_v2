require("dotenv").config();
import * as cheerio from "cheerio";
import { Op } from "sequelize";
import axios from "axios";

import {
  insertAgency,
  alreadyExists,
  insertIntoLocation,
  insertIntoPropertyV2,
  lastAdded,
} from "./queries";
import { limiter, logger as mainLogger } from "./config";
import { IRawProperty, Property, RawProperty } from "./types/model";
import {
  formatKeyValue,
  getAllPromisesResults,
  getExternalId,
} from "./utils/utils";
import {
  Feature,
  IDataToInsert,
  IFilteredUrls,
  IPagesData,
  IProperty_V2_Data,
} from "./types";

require("dotenv").config();

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

const processPage = async (link: string) => {
  logger.info("onPage ==> " + link);
  const mainPage = await axios.get(link);
  const $ = cheerio.load(mainPage.data);
  const listingLinks = $('a[aria-label="Listing link"]')
    .map((_, element) => {
      return `${process.env.BASE_URL}${$(element).attr("href") ?? ""}`;
    })
    .get();

  return listingLinks.reverse();
};

const processListing = async (
  listingUrl: string,
  lastAdded: Date,
  cityId: number
) => {
  const externalId = getExternalId(listingUrl);
  const exists = await alreadyExists(externalId);
  if (exists) {
    logger.info(`Listing ${listingUrl} already exists`);
    return;
  }
  const result = await scrapeHtmlPage(listingUrl);
  const addedDate = new Date(result.added);
  const lastAddedDate = new Date(lastAdded);
  const isAddedAfter = addedDate.getTime() > lastAddedDate.getTime();

  if (isAddedAfter) {
    await insertIntoPropertyV2(result as IProperty_V2_Data, cityId, externalId);
  }

  return isAddedAfter;
};

export const scrapListing = async (
  url: string,
  lastAdded: Date,
  cityId: number
) => {
  let nextLink: string | null = url;

  do {
    try {
      const listingLinks = await processPage(nextLink);
      const promises = listingLinks.map((link) =>
        processListing(link, lastAdded, cityId)
      );
      const results = await Promise.allSettled(promises);

      const containsOldValue = results.some(
        (result) => result.status === "fulfilled" && result.value === false
      );

      if (containsOldValue) break;

      const mainPage = await axios.get(nextLink);
      const $ = cheerio.load(mainPage.data);
      nextLink = $('a[title="Next"]').attr("href")
        ? `${process.env.BASE_URL}${$('a[title="Next"]').attr("href")}`
        : null;
    } catch (error) {
      logger.error(`Error scraping ${nextLink}: ${error}`);
    }
  } while (nextLink != null);
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

const extractAddedDateFromHtml = (html: string = "") => {
  if (!html) return {};
  const $ = cheerio.load(html);
  const keyValue: { [key: string]: any } = {};
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

    const lowerCaseKey = key.split("(")[0].toLowerCase().replace(/\s+/g, "_");
    keyValue[lowerCaseKey] = formatKeyValue(lowerCaseKey, value);
  });
  return keyValue;
};

const fetchDataForIndex = async (
  page: IPagesData,
  idx: number,
  lastAddedDbPromise: Promise<any>
) => {
  const url = page.url.replace("*", idx.toString());
  logger.info(`scraping url ==> ${url}`);
  const lastPage = (await processPage(url)).at(-1);

  if (!lastPage) return null;

  const p = await getHtmlPage({ ...page, url: lastPage });
  const scrapedData = extractAddedDateFromHtml(p?.html);
  const lastAddedDb = await lastAddedDbPromise;

  return {
    idx,
    addedDate: new Date(scrapedData.added).getTime(),
    lastAddedDate: new Date(lastAddedDb).getTime(),
  };
};

const filterOutExistingProperties = async (
  url: string,
  cityId: number,
  lastAddedDbPromise: Promise<any>
) => {
  const p = await getHtmlPage({ url, cityId });
  const scrapedData = extractAddedDateFromHtml(p?.html);
  const lastAddedDb = await lastAddedDbPromise;

  const addedDate = new Date(scrapedData.added).getTime();
  const lastAddedDate = new Date(lastAddedDb).getTime();

  return addedDate > lastAddedDate;
};

export const getFilteredUrls = async (
  page: IPagesData,
  cityLastAddedMap: Record<number, Promise<any>>
) => {
  for (let i = 1; i <= 50; ++i) {
    logger.info(`fetchDataForIndex at index :: ${i}, ${page.cityId}`);
    const results = await fetchDataForIndex(
      page,
      i,
      cityLastAddedMap[page.cityId]
    );
    if (!results) return { page, idx: i };
    const { idx, addedDate, lastAddedDate } = results;
    if (addedDate < lastAddedDate) {
      return { page, idx };
    }
  }
  return { page, idx: 50 };
};

const processUrl = async (
  url: string,
  cityId: number,
  cityLastAddedMap: Record<number, Promise<any>>
) => {
  const pageResults = await processPage(url);
  const filterPromises = pageResults.map(async (result) => {
    const shouldInclude = await filterOutExistingProperties(
      result,
      cityId,
      cityLastAddedMap[cityId]
    );
    return shouldInclude ? result : null;
  });

  const pageUrls = await getAllPromisesResults(filterPromises);

  return pageUrls.map((value) => ({
    url: value as string,
    cityId,
  }));
};

export const processInBatches = async (
  pages: Promise<{ page: IPagesData; idx: number }>[],
  batchSize: number,
  cityLastAddedMap: Record<number, Promise<any>>
) => {
  console.time("filtering urls...");
  const filteredUrls = await getAllPromisesResults(pages);
  console.timeEnd("filtering urls...");

  console.time("processing filteredUrls...");
  const filtered = await getAllPromisesResults(
    filteredUrls.map((v) => {
      const { idx, page } = v;
      const urlsToProcess = Array.from({ length: idx }, (_, i) =>
        page.url.replace("*", (idx - i).toString())
      );
      logger.info("starting processing urls ");

      return getAllPromisesResults(
        urlsToProcess.map((url) =>
          limiter.schedule(() => processUrl(url, page.cityId, cityLastAddedMap))
        )
      );
    })
  );
  console.timeEnd("processing filteredUrls...");
  const flattenedFiltered = filtered.flat(3);
  logger.info(`flattenedFiltered at ${flattenedFiltered.length}`);
  console.time("getting html for filteredUrls...");
  const dataToInsert = await getAllPromisesResults(
    flattenedFiltered.map((url) => limiter.schedule(() => getHtmlPage(url)))
  );

  console.timeEnd("getting html for filteredUrls...");

  console.log("dataToInsert => ", dataToInsert.length);

  try {
    await RawProperty.bulkCreate(dataToInsert as IRawProperty[], {
      ignoreDuplicates: true,
      returning: false,
    });
  } catch (err) {
    logger.error(`Error inserting batch in RawProperty : ${err}`);
  }
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
    const dataToInsertdResult = await Promise.allSettled(
      rawData
        .slice(i, i + batchSize)
        .map(({ url, html, city_id }) => scrapeHtmlPage(url, html, city_id))
    );
    const dataToInsert = dataToInsertdResult.map((v) =>
      v.status === "fulfilled" ? v.value : {}
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
