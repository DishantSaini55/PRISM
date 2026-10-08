import type { ProductData } from "@/lib/scrapers";

export interface StoreProvider {
  id: "amazon-india" | "flipkart" | "croma" | "reliance-digital";
  name: string;
  domains: string[];
  canHandle(url: string): boolean;
  extractProduct(url: string): Promise<ProductData>;
}
