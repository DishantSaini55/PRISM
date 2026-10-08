export type StoreAvailability = "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN" | "DISCONTINUED";

export interface StoreOffer {
  productSourceId: string;
  storeName: string;
  storeDomain: string;
  price: number | null;
  currency: string | null;
  mrp: number | null;
  seller: string | null;
  shipping: string | null;
  availability: StoreAvailability;
  lastCheckedAt: string | null;
}

export interface ComparedStoreOffer extends StoreOffer {
  discountAmount: number | null;
  discountPercentage: number | null;
}

export interface CurrencyComparison {
  currency: string;
  offers: ComparedStoreOffer[];
  bestOffer: ComparedStoreOffer;
}

export interface StoreComparison {
  currencyComparisons: CurrencyComparison[];
  bestOffer: ComparedStoreOffer | null;
  unavailableOffers: ComparedStoreOffer[];
}
