import type { ProductData } from "@/lib/scrapers";

export type PriceAvailability = "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";

export interface ProductSourceToCollect {
  id: string;
  url: string;
}

export interface PriceObservation {
  productSourceId: string;
  sourceUrl: string;
  price: number;
  currency: string;
  availability: PriceAvailability;
  checkedAt: string;
  product: ProductData;
}
