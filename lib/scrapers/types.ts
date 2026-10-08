export interface ProductData {
  sourceUrl: string;
  provider: "firecrawl";
  name: string | null;
  brand: string | null;
  model: string | null;
  category: string | null;
  currentPrice: number | null;
  mrp: number | null;
  currency: string | null;
  imageUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  availability: string | null;
  seller: string | null;
  shipping: string | null;
  color: string | null;
  storage: string | null;
  variant: string | null;
  extractedAt: string;
}

export interface ProductScraper {
  readonly name: string;
  canHandle(url: string): boolean;
  scrape(url: string): Promise<ProductData>;
}
