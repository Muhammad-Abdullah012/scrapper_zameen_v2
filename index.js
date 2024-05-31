const cheerio = require("cheerio");
const axios = require("axios").default;
const fs = require("fs");
const { scrapeHtmlPage, writeListingLinksToFile } = require("./scrap_helper");
const { getUrl } = require("./utils");
const { createTable } = require("./config");
const PROPERTY_TYPES = ["Homes", "Plots", "Commercial"];
const PROPERTY_PURPOSE = ["Buy", "Rent"];
const CITIES = ["Islamabad-3", "Karachi-2", "Lahore-1", "Rawalpindi-41"];

(async () => {
    createTable()
//   for (const city of CITIES) {
//     for (const propertyType of PROPERTY_TYPES) {
//       for (const purpose of PROPERTY_PURPOSE) {
//         const url = getUrl(propertyType, city, purpose);
//         const ws = fs.createWriteStream("urls.txt", { flags: "a" });
//         ws.write(url + "\n");
//         await writeListingLinksToFile(url, "listings.txt");
//       }
//     }
//   }
  await writeListingLinksToFile("https://www.zameen.com/Homes/Abbottabad-385-1.html?sort=date_desc", "test_listing.txt");
})();
