require("dotenv").config();
const mapping: { [key: string]: number } = {
  Crore: 7,
  Lakh: 5,
  Arab: 9,
  Thousand: 3,
};

export const formatPrice = (price: string) => {
  const parts = price.split(" ");
  if (parts.length !== 2) {
    return 0;
  }
  const match = parts[0].match(/\d+(\.\d+)?/);
  if (!match) {
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
    throw new Error("Unsupported time format");
  }

  return parseInt((timestamp.getTime() / 1000).toString());
};

export const getUrl = (propertyType: string, city: string, purpose: string) => {
  let type = purpose === "Rent" ? "Rentals" : propertyType;
  if (purpose === "Rent" && ["Plots", "Commercial"].includes(propertyType)) {
    type += "_" + propertyType;
  }
  return `${process.env.BASE_URL}/${type}/${city}-1.html?sort=date_desc`;
};
