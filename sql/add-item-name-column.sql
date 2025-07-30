-- Add item_name column to buybox_data table
-- This will store the product name from sku_asin_mapping.item_name

-- Begin transaction to ensure all changes are applied together
BEGIN;

-- Add item_name column to the buybox_data table
ALTER TABLE buybox_data 
ADD COLUMN IF NOT EXISTS item_name TEXT;

-- Add an index on item_name for better query performance
CREATE INDEX IF NOT EXISTS buybox_data_item_name_idx ON buybox_data(item_name);

-- Add comment for documentation
COMMENT ON COLUMN buybox_data.item_name IS 'Product name from sku_asin_mapping table';

-- Commit the transaction
COMMIT;

-- Verification query (run separately to verify):
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'buybox_data' AND column_name = 'item_name';
