import FirecrawlApp from "@mendable/firecrawl-js";

export function createFirecrawlClient() {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new Error("Firecrawl is not configured.");
  }

  return new FirecrawlApp({ apiKey });
}
