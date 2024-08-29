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
import { logger as mainLogger } from "./config";
import { IRawProperty, Property, RawProperty } from "./types/model";
import { formatKeyValue, getExternalId } from "./utils/utils";
import { Feature, IPagesData, IProperty_V2_Data } from "./types";

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

  return listingLinks;
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
    logger.error(`Error scraping ${page.url}: ${error}`);
    return null;
  }
};

const fetchDataForIndex = async (page: IPagesData, idx: number) => {
  const url = page.url.replace("*", idx.toString());
  logger.info(`scraping url ==> ${url}`);
  const lastPage = (await processPage(url)).at(-1);

  if (!lastPage) return null;

  const lastAddedDbPromise = lastAdded(page.cityId);
  const p = await getHtmlPage({ ...page, url: lastPage });
  const scrapedData = await scrapeHtmlPage(lastPage, p?.html, page.cityId);
  const lastAddedDb = await lastAddedDbPromise;

  return {
    idx,
    addedDate: new Date(scrapedData.added).getTime(),
    lastAddedDate: new Date(lastAddedDb).getTime(),
  };
};

const getFilteredUrls = async (page: IPagesData) => {
  for (let i = 0; i < 50; ++i) {
    logger.info("fetchDataForIndex at index :: ", i, page.cityId);
    const results = await fetchDataForIndex(page, i);
    if (!results) return { page, idx: i };
    const { idx, addedDate, lastAddedDate } = results;
    if (addedDate < lastAddedDate) {
      return { page, idx };
    }
  }
  return { page, idx: 50 };
};

export const processInBatches = async (
  page: IPagesData[],
  batchSize: number
) => {
  for (let i = 0; i < page.length; i += batchSize) {
    logger.info("processInBatches at index :: ", i);
    const filteredUrls = await Promise.all(
      page.slice(i, i + batchSize).map(getFilteredUrls)
    );
    logger.info("filteredUrls at index :: ", i);

    const filtered = await Promise.all(
      filteredUrls
        .filter((v) => v != null)
        .map(async (v) => {
          const { idx, page } = v;
          const urlsToProcess = Array.from({ length: idx }, (_, i) =>
            page.url.replace("*", (idx - i).toString())
          );

          const results = await Promise.all(
            urlsToProcess.map(async (url) => {
              const pageResults = await processPage(url);
              return pageResults.map((value) => ({
                url: value,
                cityId: page.cityId,
              }));
            })
          );

          return results.flat();
        })
    );
    logger.info("filtered at index :: ", i);

    const flattenedFiltered = filtered.flat(1);
    const dataToInsert = (
      await Promise.allSettled(
        flattenedFiltered.map((p) => (p == null ? null : getHtmlPage(p)))
      )
    )
      .map((result) => (result.status === "fulfilled" ? result.value : null))
      .filter((result) => result != null);
    try {
      await RawProperty.bulkCreate(dataToInsert as IRawProperty[], {
        ignoreDuplicates: true,
        returning: false,
      });
    } catch (err) {
      logger.error(
        `Error inserting batch in RawProperty ${i + 1}-${i + batchSize}: ${err}`
      );
    }
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
