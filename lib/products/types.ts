import type { ProductData } from "@/lib/scrapers";

export interface NormalizedProduct {
  source: ProductData;
  name: string | null;
  brand: string | null;
  model: string | null;
  category: string | null;
  storage: string | null;
  ram: string | null;
  size: string | null;
  configuration: string | null;
  edition: string | null;
  generation: string | null;
  identifiers: { gtin: string | null; upc: string | null; ean: string | null };
  color: string | null;
  variant: string | null;
  canonicalKey: string | null;
}
