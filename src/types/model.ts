import { sequelize } from "../config/sequelize";
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  literal,
  Model,
} from "sequelize";
import {
  URLS_TABLE,
  AGENCY_TABLE,
  CITIES_TABLE,
  LOCATIONS_TABLE,
  PROPERTIES_TABLE,
  RAW_PROPERTIES_TABLE,
} from "../constants/table_names";

export type PropertyType =
  | "agricultural_land"
  | "building"
  | "commercial_plot"
  | "factory"
  | "farm_house"
  | "flat"
  | "house"
  | "industrial_land"
  | "office"
  | "other"
  | "penthouse"
  | "plot_file"
  | "plot_form"
  | "residential_plot"
  | "room"
  | "shop"
  | "lower_portion"
  | "upper_portion"
  | "warehouse";

export type PropertyPurposeType = "for_sale" | "for_rent";

export interface IPropertiesModel
  extends Model<
    InferAttributes<IPropertiesModel>,
    InferCreationAttributes<IPropertiesModel>
  > {
  id: CreationOptional<number>;
  description: string;
  header: string;
  type: PropertyType;
  price: number;
  location_id: number;
  bath: number;
  area: number;
  purpose: PropertyPurposeType;
  bedroom: number;
  added: Date;
  initial_amount: string;
  monthly_installment: string;
  remaining_installments: string;
  url: string;
  created_at: Date;
  updated_at: Date;
  cover_photo_url: string;
  available: boolean;
  features: {
    category: string;
    features: string[];
  }[];
  city_id: number;
  agency_id: number;
  is_posted_by_agency: boolean;
  external_id: number | null;
}

export const Property = sequelize.define<IPropertiesModel>(
  "Property",
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    header: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM(
        "agricultural_land",
        "building",
        "commercial_plot",
        "factory",
        "farm_house",
        "flat",
        "house",
        "industrial_land",
        "office",
        "other",
        "penthouse",
        "plot_file",
        "plot_form",
        "residential_plot",
        "room",
        "shop",
        "lower_portion",
        "upper_portion",
        "warehouse"
      ),
      allowNull: true,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    location_id: {
      type: DataTypes.INTEGER,
      references: {
        model: LOCATIONS_TABLE,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      allowNull: true,
    },
    bath: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    area: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    purpose: {
      type: DataTypes.ENUM("for_sale", "for_rent"),
      allowNull: true,
    },
    bedroom: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    added: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: literal("CURRENT_TIMESTAMP"),
    },
    initial_amount: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    monthly_installment: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    remaining_installments: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: literal("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: literal("CURRENT_TIMESTAMP"),
    },
    cover_photo_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    available: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    features: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    city_id: {
      type: DataTypes.INTEGER,
      references: {
        model: CITIES_TABLE,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      allowNull: true,
    },
    agency_id: {
      type: DataTypes.INTEGER,
      references: {
        model: AGENCY_TABLE,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      allowNull: true,
    },
    is_posted_by_agency: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    external_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: PROPERTIES_TABLE,
    modelName: "Property",
    timestamps: false,
    underscored: true,
    paranoid: true,
  }
);

export interface IRawProperty
  extends Model<
    InferAttributes<IRawProperty>,
    InferCreationAttributes<IRawProperty>
  > {
  id: number;
  html: string;
  city_id: number;
  url: string;
  external_id: number;
  created_at: Date;
  updated_at: Date;
  is_processed: boolean;
}

export const RawProperty = sequelize.define<IRawProperty>(
  "RawProperty",
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    html: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    city_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    external_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    is_processed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: literal("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: literal("CURRENT_TIMESTAMP"),
    },
  },
  {
    paranoid: true,
    timestamps: false,
    underscored: true,
    modelName: "RawProperty",
    tableName: RAW_PROPERTIES_TABLE,
  }
);

export interface CityModel
  extends Model<
    InferAttributes<CityModel>,
    InferCreationAttributes<CityModel>
  > {
  id: CreationOptional<number>;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export const City = sequelize.define<CityModel>(
  "City",
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: literal("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: literal("CURRENT_TIMESTAMP"),
    },
  },
  {
    tableName: CITIES_TABLE,
    modelName: "City",
    timestamps: false,
    underscored: true,
    paranoid: true,
  }
);

export interface LocationModel
  extends Model<
    InferAttributes<LocationModel>,
    InferCreationAttributes<LocationModel>
  > {
  id: CreationOptional<number>;
  name: string;
  created_at?: Date;
  updated_at?: Date;
}

export const Location = sequelize.define<LocationModel>(
  "Location",
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: literal("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: literal("CURRENT_TIMESTAMP"),
    },
  },
  {
    tableName: LOCATIONS_TABLE,
    modelName: "Location",
    timestamps: false,
    underscored: true,
    paranoid: true,
  }
);

Property.belongsTo(Location, { foreignKey: "location_id" });
Location.hasMany(Property, { foreignKey: "location_id" });

Property.belongsTo(City, { foreignKey: "city_id" });
City.hasMany(Property, { foreignKey: "city_id" });

export class RankedPropertyForSaleView extends Model {}
RankedPropertyForSaleView.init(
  {
    ...Property.getAttributes(),
    rank: {
      type: DataTypes.INTEGER,
    },
  },
  {
    sequelize,
    modelName: "RankedPropertyForSale",
    tableName: "rankedpropertiesforsale",
    timestamps: false,
  }
);

RankedPropertyForSaleView.belongsTo(Location, { foreignKey: "location_id" });
Location.hasMany(RankedPropertyForSaleView, { foreignKey: "location_id" });

RankedPropertyForSaleView.belongsTo(City, { foreignKey: "city_id" });
City.hasMany(RankedPropertyForSaleView, { foreignKey: "city_id" });
export class RankedPropertyForRentView extends Model {}
RankedPropertyForRentView.init(
  {
    ...Property.getAttributes(),
    rank: {
      type: DataTypes.INTEGER,
    },
  },
  {
    sequelize,
    modelName: "RankedPropertyForRent",
    tableName: "rankedpropertiesforrent",
    timestamps: false,
  }
);
RankedPropertyForRentView.belongsTo(Location, { foreignKey: "location_id" });
Location.hasMany(RankedPropertyForRentView, { foreignKey: "location_id" });

RankedPropertyForRentView.belongsTo(City, { foreignKey: "city_id" });
City.hasMany(RankedPropertyForRentView, { foreignKey: "city_id" });

export class AgencyModel extends Model {}
AgencyModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    profile_url: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: literal("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: literal("CURRENT_TIMESTAMP"),
    },
  },
  {
    sequelize,
    tableName: AGENCY_TABLE,
    modelName: "Agency",
    timestamps: false,
    underscored: true,
    paranoid: true,
  }
);

Property.belongsTo(AgencyModel, { foreignKey: "agency_id" });
AgencyModel.hasMany(Property, { foreignKey: "agency_id" });

RankedPropertyForRentView.belongsTo(AgencyModel, { foreignKey: "agency_id" });
AgencyModel.hasMany(RankedPropertyForRentView, { foreignKey: "agency_id" });
RankedPropertyForSaleView.belongsTo(AgencyModel, { foreignKey: "agency_id" });
AgencyModel.hasMany(RankedPropertyForSaleView, { foreignKey: "agency_id" });

export class CountPropertiesView extends Model {}
CountPropertiesView.init(
  {
    type: { type: DataTypes.TEXT },
    count: { type: DataTypes.INTEGER },
    purpose: { type: DataTypes.TEXT },
  },
  {
    sequelize,
    tableName: "countpropertiesview",
    timestamps: false,
    underscored: true,
  }
);

export class UrlModel extends Model<
  InferAttributes<UrlModel>,
  InferCreationAttributes<UrlModel>
> {
  declare id?: number;
  declare url: string;
  declare city_id: number;
  declare is_processed?: boolean;
  declare created_at?: Date;
  declare updated_at?: Date;
}

UrlModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    city_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    is_processed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: "Url",
    tableName: URLS_TABLE,
    timestamps: false,
    underscored: true,
  }
);

UrlModel.belongsTo(City, { foreignKey: "city_id" });
