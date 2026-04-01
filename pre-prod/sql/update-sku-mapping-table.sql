-- Additional index for the sku_asin_mapping table to add min_price field
-- Requires checking if the table exists first
DO $$ 
BEGIN
    -- Check if min_price column already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sku_asin_mapping' AND column_name = 'min_price'
    ) THEN
        -- Add min_price column if it doesn't exist
        ALTER TABLE sku_asin_mapping 
        ADD COLUMN min_price NUMERIC(10, 2);
        
        COMMENT ON COLUMN sku_asin_mapping.min_price IS 'Minimum acceptable price for this SKU';
    END IF;
    
    -- Check if monitoring_enabled column already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sku_asin_mapping' AND column_name = 'monitoring_enabled'
    ) THEN
        -- Add monitoring_enabled column if it doesn't exist
        ALTER TABLE sku_asin_mapping 
        ADD COLUMN monitoring_enabled BOOLEAN DEFAULT TRUE;
        
        COMMENT ON COLUMN sku_asin_mapping.monitoring_enabled IS 'Whether this SKU should be included in Buy Box monitoring';
    END IF;
END $$;
