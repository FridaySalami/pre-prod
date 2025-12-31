/**
 * Amazon Catalog Items API Service
 * 
 * Fetches and processes product catalog data from Amazon SP-API
 * Includes product details, images, attributes, dimensions, etc.
 * 
 * Caching Strategy:
 * - 7-day TTL for catalog data (product info rarely changes)
 * - Check DB first, fall back to API if stale/missing
 * - Reduces API calls by ~80% and improves page load times
 */

import { SPAPIClient } from './sp-api-client';
import { extractKeywords, formatKeywords, type ExtractedKeywords } from '../utils/keyword-extractor';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';

const { PRIVATE_SUPABASE_SERVICE_KEY } = env;

export interface CatalogImage {
  variant: string; // MAIN, PT01-PT08, etc.
  link: string;
  height: number;
  width: number;
}

export interface CatalogDimensions {
  height?: { value: number; unit: string };
  width?: { value: number; unit: string };
  length?: { value: number; unit: string };
  weight?: { value: number; unit: string };
}

export interface CatalogProduct {
  asin: string;
  title: string;
  brand?: string;
  manufacturer?: string;
  category?: string;
  categoryId?: string;
  images: CatalogImage[];
  mainImage?: string;
  bulletPoints?: string[];
  description?: string;
  packageQuantity?: number;
  dimensions?: CatalogDimensions;
  attributes?: Record<string, any>;
  itemClassification?: string; // BASE_PRODUCT, VARIATION_PARENT, etc.
  variationTheme?: string;
  parentAsin?: string;
  keywords?: ExtractedKeywords; // Extracted keywords
}

export class CatalogService {
  private client: SPAPIClient;
  private marketplaceId: string;
  private supabase: ReturnType<typeof createClient>;
  private cacheEnabled: boolean = true; // Toggle caching on/off
  private readonly CACHE_TTL_DAYS = 7;

  constructor(client: SPAPIClient, marketplaceId: string = 'A1F83G8C2ARO7P') {
    this.client = client;
    this.marketplaceId = marketplaceId;

    // Initialize Supabase client for caching
    this.supabase = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY);
  }

  /**
   * Get comprehensive product catalog data
   * Strategy: Check cache first (7-day TTL), then API if stale/missing
   */
  async getProduct(asin: string): Promise<CatalogProduct> {
    // 1. Try cache first
    if (this.cacheEnabled) {
      const cached = await this.getCachedProduct(asin);
      if (cached) {
        console.log(`✅ Cache hit for ${asin}`);
        return cached;
      }
      console.log(`⚠️ Cache miss for ${asin}, fetching from API...`);
    }

    // 2. Fetch from API
    const result = await this.client.get(`/catalog/2022-04-01/items/${asin}`, {
      queryParams: {
        marketplaceIds: this.marketplaceId,
        includedData: 'summaries,images,attributes,dimensions,identifiers,salesRanks'
      }
    });

    if (!result.success || !result.data) {
      throw new Error(`Failed to fetch catalog data for ${asin}: ${result.errors?.[0]?.message || 'Unknown error'}`);
    }

    const product = this.parseProduct(result.data);

    // 3. Cache the result
    if (this.cacheEnabled) {
      await this.setCachedProduct(product);
    }

    return product;
  }

  /**
   * Parse API response into structured product data
   */
  private parseProduct(data: any): CatalogProduct {
    const summary = data.summaries?.[0] || {};
    const images = data.images?.[0]?.images || [];
    const attributes = data.attributes || {};
    const dimensions = data.dimensions?.[0] || {};

    // Extract main image (MAIN variant or first available)
    const mainImageObj = images.find((img: any) => img.variant === 'MAIN') || images[0];
    const mainImage = mainImageObj?.link;

    // Process all images and deduplicate by variant
    // Amazon returns same image at different sizes with different IDs:
    // - MAIN: 61e3RmHxD9L (1000px), 51ukzSfH1AL (500px), 51ukzSfH1AL._SL75_ (75px)
    // - PT01: 61jSZIelLxL (1000px), 41RYlEth61L (500px), etc.
    // We want the largest version of each VARIANT (MAIN, PT01, PT02, etc.)
    const imageMap = new Map<string, any>();

    images.forEach((img: any) => {
      const variant = img.variant;

      // Keep the largest version (highest width) for each variant
      const existing = imageMap.get(variant);
      if (!existing || img.width > existing.width) {
        imageMap.set(variant, img);
      }
    });

    // Convert back to array, maintaining order
    const productImages: CatalogImage[] = Array.from(imageMap.values()).map((img: any) => ({
      variant: img.variant,
      link: img.link,
      height: img.height,
      width: img.width
    }));

    // Extract bullet points from attributes
    const bulletPoints: string[] = [];
    if (attributes.bullet_point) {
      attributes.bullet_point.forEach((bp: any) => {
        if (bp.value) bulletPoints.push(bp.value);
      });
    }

    // Extract description
    let description: string | undefined;
    if (attributes.product_description?.[0]?.value) {
      description = attributes.product_description[0].value;
    }

    // Extract dimensions
    const productDimensions: CatalogDimensions = {};
    if (dimensions.package) {
      productDimensions.height = dimensions.package.height;
      productDimensions.width = dimensions.package.width;
      productDimensions.length = dimensions.package.length;
      productDimensions.weight = dimensions.package.weight;
    } else if (dimensions.item) {
      productDimensions.height = dimensions.item.height;
      productDimensions.width = dimensions.item.width;
      productDimensions.length = dimensions.item.length;
      productDimensions.weight = dimensions.item.weight;
    }

    // Extract keywords from title and bullet points
    const title = summary.itemName || attributes.item_name?.[0]?.value || data.asin;
    const brand = summary.brand || attributes.brand?.[0]?.value;
    const category = summary.browseClassification?.displayName;
    const keywords = extractKeywords(title, bulletPoints, category, brand);

    return {
      asin: data.asin,
      title,
      brand,
      manufacturer: attributes.manufacturer?.[0]?.value,
      category,
      categoryId: summary.browseClassification?.classificationId,
      images: productImages,
      mainImage,
      bulletPoints: bulletPoints.length > 0 ? bulletPoints : undefined,
      description,
      packageQuantity: summary.packageQuantity,
      dimensions: Object.keys(productDimensions).length > 0 ? productDimensions : undefined,
      attributes,
      itemClassification: summary.itemClassification,
      variationTheme: summary.variationTheme,
      parentAsin: summary.parentAsin,
      keywords // Extracted keywords
    };
  }

  /**
   * Get product title only (faster, less data)
   */
  async getProductTitle(asin: string): Promise<string> {
    const result = await this.client.get(`/catalog/2022-04-01/items/${asin}`, {
      queryParams: {
        marketplaceIds: this.marketplaceId,
        includedData: 'summaries'
      }
    });

    if (!result.success || !result.data) {
      return asin; // Fallback to ASIN
    }

    const summary = result.data.summaries?.[0];
    return summary?.itemName || asin;
  }

  /**
   * Batch get product titles for multiple ASINs
   */
  async getProductTitles(asins: string[]): Promise<Map<string, string>> {
    const titles = new Map<string, string>();

    // Process in batches to respect rate limits
    for (const asin of asins) {
      try {
        const title = await this.getProductTitle(asin);
        titles.set(asin, title);

        // Small delay between requests (rate limit: 5 req/sec)
        await new Promise(resolve => setTimeout(resolve, 250));
      } catch (error) {
        console.error(`Failed to get title for ${asin}:`, error);
        titles.set(asin, asin); // Fallback to ASIN
      }
    }

    return titles;
  }

  /**
   * Search catalog by keywords (useful for finding related products)
   */
  async searchProducts(keywords: string, limit: number = 10): Promise<CatalogProduct[]> {
    const result = await this.client.get('/catalog/2022-04-01/items', {
      queryParams: {
        marketplaceIds: this.marketplaceId,
        keywords,
        pageSize: limit.toString(),
        includedData: 'summaries,images'
      }
    });

    if (!result.success || !result.data?.items) {
      return [];
    }

    return result.data.items.map((item: any) => this.parseProduct(item));
  }

  /**
   * Get cached product from database
   * Returns null if not found or older than TTL (7 days)
   */
  private async getCachedProduct(asin: string): Promise<CatalogProduct | null> {
    try {
      const { data, error } = await this.supabase
        .from('amazon_catalog_cache')
        .select('*')
        .eq('asin', asin)
        .eq('marketplace_id', this.marketplaceId)
        .gte('updated_at', new Date(Date.now() - this.CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString())
        .single();

      if (error || !data) {
        return null;
      }

      // Reconstruct CatalogProduct from cached data
      const images = (data.images as CatalogImage[]) || [];
      return {
        asin: data.asin as string,
        title: data.title as string,
        brand: data.brand as string | undefined,
        category: data.category as string | undefined,
        images,
        mainImage: images[0]?.link,
        bulletPoints: data.bullet_points as string[] | undefined,
        dimensions: data.dimensions as CatalogDimensions | undefined,
        attributes: data.attributes as Record<string, any> | undefined,
        keywords: data.keywords as ExtractedKeywords | undefined,
        // Optional fields that might not be in cache
        manufacturer: (data.attributes as any)?.manufacturer?.[0]?.value,
        categoryId: undefined,
        description: undefined,
        packageQuantity: undefined,
        itemClassification: undefined,
        variationTheme: undefined,
        parentAsin: undefined
      };
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  /**
   * Cache product data in database
   */
  private async setCachedProduct(product: CatalogProduct): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('amazon_catalog_cache')
        .upsert({
          asin: product.asin,
          marketplace_id: this.marketplaceId,
          title: product.title,
          brand: product.brand,
          category: product.category,
          product_type: product.itemClassification,
          images: product.images,
          bullet_points: product.bulletPoints,
          dimensions: product.dimensions,
          attributes: product.attributes,
          keywords: product.keywords,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'asin,marketplace_id'
        });

      if (error) {
        console.error('Cache write error:', error);
      }
    } catch (error) {
      console.error('Cache write exception:', error);
      // Don't throw - caching is not critical
    }
  }
}
