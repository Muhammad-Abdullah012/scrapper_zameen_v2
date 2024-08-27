import * as cheerio from "cheerio";
import { Op } from "sequelize";
import axios from "axios";

import {
  insertAgency,
  alreadyExists,
  insertIntoLocation,
  insertIntoPropertyV2,
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

const filterOutExistingUrls = async (
  pages: (IPagesData | null)[]
): Promise<(IPagesData | null)[]> => {
  if (!pages.length) return pages;

  const externalIds = pages
    .map((page) => page && getExternalId(page.url))
    .filter((id): id is number => id !== null);

  if (externalIds.length === 0) return pages;

  const existingUrlsSet = new Set(
    (
      await Property.findAll({
        where: { external_id: { [Op.in]: externalIds } },
        attributes: ["url"],
      })
    ).map((property) => property.url)
  );

  return pages.filter((page) => page && !existingUrlsSet.has(page.url));
};

const getFilteredUrls = async (
  batch: IPagesData[]
): Promise<(IPagesData | null)[]> => {
  const batchResult = (
    await Promise.allSettled(
      batch.map((p) =>
        processPage(p.url).then((result) =>
          result.map((value) => ({ url: value, cityId: p.cityId }))
        )
      )
    )
  ).flatMap((result) => (result.status === "fulfilled" ? result.value : null));

  return filterOutExistingUrls(batchResult);
};

export const processInBatches = async (
  page: IPagesData[],
  batchSize: number
) => {
  for (let i = 0; i < page.length; i += batchSize) {
    const dataToInsert = (
      await Promise.allSettled(
        (
          await getFilteredUrls(page.slice(i, i + batchSize))
        ).map((p) => (p == null ? null : getHtmlPage(p)))
      )
    )
      .map((result) => (result.status === "fulfilled" ? result.value : null))
      .filter((result) => result != null);

    await RawProperty.bulkCreate(dataToInsert as IRawProperty[], {
      ignoreDuplicates: true,
    });
  }
};
