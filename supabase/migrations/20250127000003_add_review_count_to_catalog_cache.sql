-- Add customer review count column to amazon_catalog_cache table
-- This stores the review count from Amazon Catalog API (limited to count only, no ratings available)

ALTER TABLE amazon_catalog_cache
ADD COLUMN IF NOT EXISTS customer_review_count INTEGER;

-- Add index for review count queries (useful for sorting/filtering by popularity)
CREATE INDEX IF NOT EXISTS idx_catalog_cache_review_count 
ON amazon_catalog_cache (customer_review_count DESC NULLS LAST);

-- Add column comment
COMMENT ON COLUMN amazon_catalog_cache.customer_review_count IS 'Number of customer reviews from Catalog API (count only, no star ratings available from this API)';
