import { Op } from "sequelize";
import { City } from "./types/model";
import { getUrl } from "./utils/utils";
import { logger as mainLogger } from "./config";
import { processInBatches } from "./scrap_helper";

const logger = mainLogger.child({ file: "index" });

const PROPERTY_TYPES = ["Homes", "Plots", "Commercial"];
const PROPERTY_PURPOSE = ["Buy", "Rent"];
const CITIES = ["Islamabad-3", "Karachi-2", "Lahore-1", "Rawalpindi-41"];

(async () => {
  try {
    const cityModels = await City.findAll({
      where: {
        name: {
          [Op.in]: CITIES.map((c) => c.split("-")[0]),
        },
      },
      attributes: ["id", "name"],
    });

    const citiesMap = cityModels.reduce((acc, city) => {
      const cityKey = CITIES.find((c) => c.startsWith(city.name));
      if (cityKey) {
        acc[cityKey] = city.id;
      }
      return acc;
    }, {} as Record<string, number>);

    const pages = CITIES.flatMap((city) =>
      PROPERTY_TYPES.flatMap((propertyType) =>
        PROPERTY_PURPOSE.flatMap((purpose) =>
          getUrl(propertyType, city, purpose, citiesMap[city])
        )
      )
    );
    const BATCH_SIZE = 20;
    await processInBatches(pages, BATCH_SIZE);
  } catch (err) {
    logger.error(err);
  }
})().catch((err) => {
  logger.fatal(`Unhandled error: ${err.message}`, { error: err });
  process.exit(1);
});
