-- Add title column to amazon_sales_data table
-- Note: Amazon Reports API (JSON) does NOT include product titles
-- This column is reserved for future use - titles can be fetched separately via:
--   1. Amazon Catalog Items API (sp-api)
--   2. Existing product database
--   3. Manual CSV imports

ALTER TABLE amazon_sales_data
ADD COLUMN IF NOT EXISTS title TEXT;

-- Add index for title search (for when we populate titles later)
CREATE INDEX IF NOT EXISTS idx_amazon_sales_data_title ON amazon_sales_data USING gin(to_tsvector('english', title));

COMMENT ON COLUMN amazon_sales_data.title IS 'Product title (optional) - not available in Reports API, must be fetched separately';
