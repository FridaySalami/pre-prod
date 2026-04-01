-- Add previous_price column to buybox_data table
-- This column stores the price before the last update for change tracking

ALTER TABLE buybox_data 
ADD COLUMN IF NOT EXISTS previous_price NUMERIC(10, 2);

-- Add comment for documentation
COMMENT ON COLUMN buybox_data.previous_price IS 'The price before the last update via match buy box functionality';

-- Optional: Update existing records to set previous_price equal to current price
-- (This is safe to run multiple times due to WHERE clause)
UPDATE buybox_data 
SET previous_price = your_current_price 
WHERE previous_price IS NULL 
  AND your_current_price IS NOT NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'buybox_data' 
  AND column_name = 'previous_price';
