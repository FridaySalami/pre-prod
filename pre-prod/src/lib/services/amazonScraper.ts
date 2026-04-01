/**
 * Amazon Product Title Scraper
 * Fetches product titles by scraping Amazon product pages
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Scrape product title from Amazon product page
 */
export async function scrapeAmazonTitle(asin: string): Promise<string | null> {
  try {
    const url = `https://www.amazon.co.uk/dp/${asin}`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 10000,
      maxRedirects: 5
    });

    const $ = cheerio.load(response.data);

    // Try multiple selectors for the product title
    const titleSelectors = [
      '#productTitle',
      'h1.a-size-large',
      'h1 span',
      '[data-automation-id="title"]',
      '.product-title'
    ];

    for (const selector of titleSelectors) {
      const title = $(selector).first().text().trim();
      if (title && title.length > 5) {
        return title;
      }
    }

    return null;

  } catch (error: unknown) {
    console.error(`Error scraping title for ASIN ${asin}:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Scrape multiple ASINs with rate limiting
 */
export async function scrapeMultipleTitles(asins: string[]): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {};

  for (const asin of asins) {
    try {
      results[asin] = await scrapeAmazonTitle(asin);
      // Rate limit: wait 2 seconds between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Failed to scrape ${asin}:`, error);
      results[asin] = null;
    }
  }

  return results;
}
