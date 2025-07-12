-- skus reference table: Updates or creates the SKU reference table for Buy Box monitoring
-- This table includes cost and pricing data needed for profitability calculations

-- Check if table exists first
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'skus') THEN
        -- Create skus table if it doesn't exist
        CREATE TABLE skus (
            sku TEXT PRIMARY KEY,
            cost NUMERIC(10, 2), -- Purchase cost
            handling_cost NUMERIC(10, 2), -- Estimated labor cost
            shipping_cost NUMERIC(10, 2), -- Delivery cost
            min_price NUMERIC(10, 2), -- Price floor (never go below this)
            auto_pricing_enabled BOOLEAN DEFAULT FALSE, -- Future feature
            monitoring_enabled BOOLEAN DEFAULT TRUE, -- Optional override flag
            category TEXT, -- Optional category
            brand TEXT, -- Optional brand
            priority_score INTEGER, -- Optional priority score
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Add comment
        COMMENT ON TABLE skus IS 'Reference table for SKU data related to Buy Box monitoring';
    ELSE
        -- Table exists, so add any missing columns
        
        -- Add min_price if it doesn't exist
        IF NOT EXISTS (SELECT FROM pg_attribute 
                       WHERE attrelid = 'skus'::regclass 
                       AND attname = 'min_price' 
                       AND NOT attisdropped) THEN
            ALTER TABLE skus ADD COLUMN min_price NUMERIC(10, 2);
        END IF;
        
        -- Add monitoring_enabled if it doesn't exist
        IF NOT EXISTS (SELECT FROM pg_attribute 
                       WHERE attrelid = 'skus'::regclass 
                       AND attname = 'monitoring_enabled' 
                       AND NOT attisdropped) THEN
            ALTER TABLE skus ADD COLUMN monitoring_enabled BOOLEAN DEFAULT TRUE;
        END IF;
        
        -- Add auto_pricing_enabled if it doesn't exist
        IF NOT EXISTS (SELECT FROM pg_attribute 
                       WHERE attrelid = 'skus'::regclass 
                       AND attname = 'auto_pricing_enabled' 
                       AND NOT attisdropped) THEN
            ALTER TABLE skus ADD COLUMN auto_pricing_enabled BOOLEAN DEFAULT FALSE;
        END IF;
        
        -- Add handling_cost if it doesn't exist
        IF NOT EXISTS (SELECT FROM pg_attribute 
                       WHERE attrelid = 'skus'::regclass 
                       AND attname = 'handling_cost' 
                       AND NOT attisdropped) THEN
            ALTER TABLE skus ADD COLUMN handling_cost NUMERIC(10, 2);
        END IF;
        
        -- Add shipping_cost if it doesn't exist
        IF NOT EXISTS (SELECT FROM pg_attribute 
                       WHERE attrelid = 'skus'::regclass 
                       AND attname = 'shipping_cost' 
                       AND NOT attisdropped) THEN
            ALTER TABLE skus ADD COLUMN shipping_cost NUMERIC(10, 2);
        END IF;
    END IF;
END $$;

-- Create or update indexes
CREATE INDEX IF NOT EXISTS skus_monitoring_enabled_idx ON skus(monitoring_enabled) WHERE monitoring_enabled = TRUE;
CREATE INDEX IF NOT EXISTS skus_category_idx ON skus(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS skus_brand_idx ON skus(brand) WHERE brand IS NOT NULL;

-- Update existing skus with data from inventory_profit_calculator if available
-- Note: This is a placeholder - adjust table and column names to match your actual schema
/*
UPDATE skus s
SET 
    cost = ipc.cost,
    handling_cost = ipc.handling_cost,
    shipping_cost = ipc.shipping_cost
FROM inventory_profit_calculator ipc
WHERE s.sku = ipc.sku
  AND ipc.cost IS NOT NULL;
*/

-- Add comments
COMMENT ON COLUMN skus.min_price IS 'Minimum price allowed for this SKU (price floor)';
COMMENT ON COLUMN skus.monitoring_enabled IS 'Whether this SKU should be included in Buy Box monitoring';
COMMENT ON COLUMN skus.auto_pricing_enabled IS 'Whether automatic price adjustments are allowed (future feature)';
COMMENT ON COLUMN skus.handling_cost IS 'Estimated labor cost for handling this SKU';
COMMENT ON COLUMN skus.shipping_cost IS 'Estimated shipping cost for this SKU';
