import { firecrawlProductScraper } from "./firecrawl";
import type { ProductData, ProductScraper } from "./types";

const scrapers: ProductScraper[] = [firecrawlProductScraper];

export function getProductScraper(url: string) {
  return scrapers.find((scraper) => scraper.canHandle(url)) ?? null;
}

export async function scrapeProduct(url: string): Promise<ProductData> {
  const scraper = getProductScraper(url);

  if (!scraper) {
    throw new Error("No product scraper can handle this URL.");
  }

  return scraper.scrape(url);
}
