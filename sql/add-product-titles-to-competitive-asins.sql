-- Add product title fields to competitive_asins table
-- This enhancement will help distinguish between different product variations
-- like bundle quantities (6-pack vs 8-pack) of the same item

BEGIN;

-- Add product title columns to the competitive_asins table
ALTER TABLE competitive_asins 
ADD COLUMN IF NOT EXISTS primary_product_title TEXT,
ADD COLUMN IF NOT EXISTS competitive_product_title TEXT;

-- Create indexes for the new title fields to improve search performance
CREATE INDEX IF NOT EXISTS idx_competitive_asins_primary_title 
ON competitive_asins(primary_product_title);

CREATE INDEX IF NOT EXISTS idx_competitive_asins_competitive_title 
ON competitive_asins(competitive_product_title);

-- Add full-text search indexes for better title searching
CREATE INDEX IF NOT EXISTS idx_competitive_asins_primary_title_fts 
ON competitive_asins USING gin(to_tsvector('english', primary_product_title));

CREATE INDEX IF NOT EXISTS idx_competitive_asins_competitive_title_fts 
ON competitive_asins USING gin(to_tsvector('english', competitive_product_title));

-- Add comments for documentation
COMMENT ON COLUMN competitive_asins.primary_product_title IS 'Product title of the primary ASIN to help identify product variations';
COMMENT ON COLUMN competitive_asins.competitive_product_title IS 'Product title of the competitive ASIN to help distinguish between variations like bundle quantities';

-- Display success message
SELECT 'Product title fields added to competitive_asins table successfully!' as message;

COMMIT;
