require("dotenv").config();
import { Op } from "sequelize";
import { sequelize } from "./config/sequelize";
import { logger as mainLogger } from "./config";
import { IinsertIntoAgencyProps } from "./types";
import { AgencyModel, Location, Property } from "./types/model";

const logger = mainLogger.child({ file: "queries" });

export const insertIntoLocation = async (location: string) => {
  try {
    return sequelize.transaction(async (transaction) => {
      const [insertResult] = await Location.findOrCreate({
        where: { name: location },
        defaults: { name: location },
        transaction,
        returning: ["id"],
      });

      return insertResult.id;
    });
  } catch (error) {
    logger.error(`error inserting into Location: ${error}`);
    return null;
  }
};

export const lastAdded = async (cityId: number) => {
  try {
    const result = await Property.findOne({
      where: {
        city_id: cityId,
        added: {
          [Op.ne]: null as unknown as Date,
        },
      },
      attributes: ["added"],
      order: [["added", "DESC"]],
    });
    return result?.added ?? null;
  } catch (error) {
    logger.error(`error getting last added: ${error}`);
    return null;
  }
};

export const insertAgency = async ({
  title: agencyName,
  profileUrl,
}: IinsertIntoAgencyProps) => {
  if (!agencyName || !profileUrl) return null;
  const agencyProfileUrl = `${process.env.BASE_URL}${profileUrl}`;

  try {
    return sequelize.transaction(async (transaction) => {
      const [insertResult] = await AgencyModel.findOrCreate({
        where: { profile_url: agencyProfileUrl },
        defaults: { title: agencyName, profile_url: agencyProfileUrl },
        transaction,
        returning: ["id"],
      });

      return insertResult.id;
    });
  } catch (error) {
    logger.error(`Error inserting into AgencyModel: ${error}`);
    return null;
  }
};
