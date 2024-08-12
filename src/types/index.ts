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
}

export interface Feature {
  category: string;
  features: string[];
}
