import { logger as mainLogger } from "../config";
require("dotenv").config();

const logger = mainLogger.child({ file: "utils" });
const mapping: { [key: string]: number } = {
  Crore: 7,
  Lakh: 5,
  Arab: 9,
  Thousand: 3,
};

export const formatPrice = (price: string) => {
  const parts = price.split(" ");
  if (parts.length !== 2) {
    logger.debug(`price format is not correct: ${price}`);
    return 0;
  }
  const match = parts[0].match(/\d+(\.\d+)?/);
  if (!match) {
    logger.debug(`price format is not correct: ${price}`);
    return 0;
  }
  const numericPart = match[0];
  let numericValue = parseFloat(numericPart);

  numericValue *= Math.pow(10, mapping[parts[1]]);

  return numericValue;
};

export const relativeTimeToTimestamp = (relativeTime: string) => {
  const now = new Date();

  let timestamp;
  if (relativeTime.includes("second")) {
    const secondsAgo = parseInt(relativeTime.split(" ")[0]);
    timestamp = new Date(now.getTime() - secondsAgo * 1000);
  } else if (relativeTime.includes("minute")) {
    const minutesAgo = parseInt(relativeTime.split(" ")[0]);
    timestamp = new Date(now.getTime() - minutesAgo * 60000);
  } else if (relativeTime.includes("hour")) {
    const hoursAgo = parseInt(relativeTime.split(" ")[0]);
    timestamp = new Date(now.getTime() - hoursAgo * 3600000);
  } else if (relativeTime.includes("day")) {
    const daysAgo = parseInt(relativeTime.split(" ")[0]);
    timestamp = new Date(now.getTime() - daysAgo * 86400000);
  } else if (relativeTime.includes("week")) {
    const weeksAgo = parseInt(relativeTime.split(" ")[0]);
    timestamp = new Date(now.getTime() - weeksAgo * 604800000);
  } else if (relativeTime.includes("month")) {
    const monthsAgo = parseInt(relativeTime.split(" ")[0]);
    // Assuming a month has 30 days for simplicity
    timestamp = new Date(now.getTime() - monthsAgo * 2592000000);
  } else {
    logger.debug(`relative time format is not correct: ${relativeTime}`);
    return null;
  }

  return timestamp.toISOString();
};

export const getUrl = (propertyType: string, city: string, purpose: string) => {
  let type = purpose === "Rent" ? "Rentals" : propertyType;
  if (purpose === "Rent" && ["Plots", "Commercial"].includes(propertyType)) {
    type += "_" + propertyType;
  }
  return `${process.env.BASE_URL}/${type}/${city}-1.html?sort=date_desc`;
};

export const formatArea = (area: string) => {
  if (area.length === 0) {
    return 0;
  }
  const area_array = area.split(" ");
  const area_unit = area_array.slice(1).join(" ");
  let factor = 1;
  // Transform area to square feet
  switch (area_unit) {
    case "Marla": {
      factor = 225;
      break;
    }
    case "Kanal": {
      factor = 4500;
      break;
    }
    case "Sq. Yd.": {
      factor = 9;
      break;
    }
    default: {
      console.error(`Invalid area unit: ${area_unit}`);
    }
  }
  return Number(area_array[0].replace(/,/g, "")) * factor;
};

export const formatBath = (bath: string) => {
  if (bath.length === 0) {
    return 0;
  }
  const bath_array = bath.split(" ");
  return Number(bath_array[0]);
};

export const formatBedroom = (bedroom: string) => {
  return formatBath(bedroom);
};

export const formatPurpose = (purpose: string) => {
  return purpose.toLowerCase().replace(/\s/g, "_");
};

export const formatType = (type: string) => {
  return formatPurpose(type);
};

export const formatKeyValue = (key: string, value: string) => {
  const formatters = {
    price: formatPrice,
    added: relativeTimeToTimestamp,
    area: formatArea,
    bath: formatBath,
    bedroom: formatBedroom,
    purpose: formatPurpose,
    type: formatType,
  };

  if (formatters[key as keyof typeof formatters]) {
    return formatters[key as keyof typeof formatters](value);
  }

  return value;
};
