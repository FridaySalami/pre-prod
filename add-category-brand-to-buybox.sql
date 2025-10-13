-- Add category and brand columns to buybox_data table
-- These columns store product metadata for better filtering and analysis

ALTER TABLE buybox_data
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS brand TEXT;

-- Create indexes for filtering by category and brand
CREATE INDEX IF NOT EXISTS buybox_data_category_idx ON buybox_data(category);
CREATE INDEX IF NOT EXISTS buybox_data_brand_idx ON buybox_data(brand);

-- Add comments for documentation
COMMENT ON COLUMN buybox_data.category IS 'Product category from Amazon catalog data';
COMMENT ON COLUMN buybox_data.brand IS 'Product brand from Amazon catalog data';
