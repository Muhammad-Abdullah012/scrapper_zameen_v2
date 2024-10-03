import { mapping } from "../constants";
import {
  formatArea,
  formatPrice,
  relativeTimeToTimestamp,
} from "../utils/utils";

describe("utils/utils.ts", () => {
  describe("formatPrice function", () => {
    it("should return correct price for valid format", () => {
      const price = "123.45 Crore";
      const expected = 123.45 * Math.pow(10, mapping["Crore"]);
      expect(formatPrice(price)).toBeCloseTo(expected);
    });

    it("should return 0 for invalid price format", () => {
      const price = "abc";
      expect(formatPrice(price)).toBe(0);
    });

    it("should return 0 for missing or unknown unit", () => {
      const price = "123.45 Unknown";
      expect(formatPrice(price)).toBe(0);
    });

    it("should handle edge cases (very large numbers)", () => {
      const price = "1234567890.12 Crore";
      const expected = 1234567890.12 * Math.pow(10, mapping["Crore"]);
      expect(formatPrice(price)).toBeCloseTo(expected);
    });

    it("should handle edge cases (very small numbers)", () => {
      const price = "0.000001 Lakh";
      const expected = 0.000001 * Math.pow(10, mapping["Lakh"]);
      expect(formatPrice(price)).toBeCloseTo(expected);
    });
  });

  describe("relativeTimeToTimestamp", () => {
    it('should return a valid timestamp for "second" relative time', () => {
      const relativeTime = "10 seconds";
      const timestamp = relativeTimeToTimestamp(relativeTime);
      expect(timestamp).not.toBeNull();
      expect(typeof timestamp === "string").toBe(true);
    });

    it('should return a valid timestamp for "minute" relative time', () => {
      const relativeTime = "10 minutes";
      const timestamp = relativeTimeToTimestamp(relativeTime);
      expect(timestamp).not.toBeNull();
      expect(typeof timestamp === "string").toBe(true);
    });

    it('should return a valid timestamp for "hour" relative time', () => {
      const relativeTime = "10 hours";
      const timestamp = relativeTimeToTimestamp(relativeTime);
      expect(timestamp).not.toBeNull();
      expect(typeof timestamp === "string").toBe(true);
    });

    it('should return a valid timestamp for "day" relative time', () => {
      const relativeTime = "10 days";
      const timestamp = relativeTimeToTimestamp(relativeTime);
      expect(timestamp).not.toBeNull();
      expect(typeof timestamp === "string").toBe(true);
    });

    it('should return a valid timestamp for "week" relative time', () => {
      const relativeTime = "10 weeks";
      const timestamp = relativeTimeToTimestamp(relativeTime);
      expect(timestamp).not.toBeNull();
      expect(typeof timestamp === "string").toBe(true);
    });

    it('should return a valid timestamp for "month" relative time', () => {
      const relativeTime = "10 months";
      const timestamp = relativeTimeToTimestamp(relativeTime);
      expect(timestamp).not.toBeNull();
      expect(typeof timestamp === "string").toBe(true);
    });

    it("should return null for invalid relative time", () => {
      const relativeTime = "10 years";
      const timestamp = relativeTimeToTimestamp(relativeTime);
      expect(timestamp).toBeNull();
    });

    it("should return null for relative time with non-numeric value", () => {
      const relativeTime = "ten seconds";
      const timestamp = relativeTimeToTimestamp(relativeTime);
      expect(timestamp).toBeNull();
    });

    it("should return null for relative time with missing unit", () => {
      const relativeTime = "10";
      const timestamp = relativeTimeToTimestamp(relativeTime);
      expect(timestamp).toBeNull();
    });

    it("should catch and log error for invalid input", () => {
      const relativeTime = " invalid input ";
      const timestamp = relativeTimeToTimestamp(relativeTime);
      expect(timestamp).toBeNull();
    });
  });

  describe("formatArea function", () => {
    it("should return 0 for empty string input", () => {
      expect(formatArea("")).toBe(0);
    });

    it("should return correct area for Marla unit", () => {
      expect(formatArea("10 Marla")).toBe(2250);
    });

    it("should return correct area for Kanal unit", () => {
      expect(formatArea("10 Kanal")).toBe(45000);
    });

    it("should return correct area for Sq. Yd. unit", () => {
      expect(formatArea("10 Sq. Yd.")).toBe(90);
    });

    it("should return 0 for invalid area unit", () => {
      expect(formatArea("10 Unknown")).toBe(0);
    });

    it("should handle area string with comma in numeric value", () => {
      expect(formatArea("1,000 Marla")).toBe(225000);
    });

    it("should return 0 for area string with non-numeric value", () => {
      expect(formatArea("abc Marla")).toBe(0);
    });
  });
});
