import type { ProductData } from "@/lib/scrapers";

export interface NormalizedProduct {
  source: ProductData;
  name: string | null;
  brand: string | null;
  model: string | null;
  category: string | null;
  storage: string | null;
  color: string | null;
  variant: string | null;
  canonicalKey: string | null;
}
