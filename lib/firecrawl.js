import { scrapeProduct as scrapeStructuredProduct } from "@/lib/scrapers";

export async function scrapeProduct(url) {
  try {
    const product = await scrapeStructuredProduct(url);

    if (!product.name) {
      throw new Error("No data extracted from URL");
    }

    // Temporary adapter for the existing URL-tracking code.
    // Later pipeline steps will consume ProductData directly.
    return {
      productName: product.name,
      currentPrice: product.currentPrice,
      currencyCode: product.currency,
      productImageUrl: product.imageUrl
    };
  } catch (error) {
    console.error("Firecrawl scrape error:", error);
    throw new Error(`Failed to scrape product: ${error.message}`);
  }
}
