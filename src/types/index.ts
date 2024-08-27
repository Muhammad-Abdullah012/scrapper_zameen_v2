export interface IProperty_V2_Data {
  desc?: string;
  header?: string;
  type?: string;
  price?: number;
  location?: string;
  bath?: string;
  area?: string;
  purpose?: string;
  bedroom?: string;
  added?: string;
  initial_amount?: string;
  monthly_installment?: string;
  remaining_installments?: string;
  url?: string;
  coverPhotoUrl?: string;
  features?: Feature[];
  isPostedByAgency: boolean;
  agency_id?: number;
}

export interface Feature {
  category: string;
  features: string[];
}

export interface IinsertIntoAgencyProps {
  title: string | undefined;
  profileUrl: string | undefined;
}

export interface IPropertiesDataToInsert {
  result: IProperty_V2_Data;
  externalId: number | null;
  cityId: number;
}

export interface IPagesData {
  url: string;
  cityId: number;
}
