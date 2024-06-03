import * as cheerio from "cheerio";
const axios = require("axios").default;
const fs = require("fs");
import { insertIntoPropertyV2 } from "./queries";
import { formatPrice, relativeTimeToTimestamp } from "./utils";
require("dotenv").config();

export const scrapeHtmlPage = async (url: string) => {
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

export const writeListingLinksToFile = async (
  url: string,
  filename: string
) => {
  let nextLink: string | null = url;
  do {
    const mainPage = await axios.get(nextLink);
    const $ = cheerio.load(mainPage.data);
    const ws = fs.createWriteStream(filename, { flags: "a" });
    $('a[aria-label="Listing link"]')
      .each(function () {
        const href = `${process.env.BASE_URL}${$(this).attr("href")}`;
        console.log("scraping href ==> ", href);
        scrapeHtmlPage(href)
          .then((data) => {
            insertIntoPropertyV2(data);
            ws.write(`${href}\n`);
          })
          .catch((error) => {
            console.log("error scraping href ==> ", href);
            console.log(error);
          });
      })
      .get();
    nextLink = $('a[title="Next"]').attr("href") || null;
    if (nextLink) {
      nextLink = `${process.env.BASE_URL}${nextLink}`;
    }
  } while (nextLink != null);
};
