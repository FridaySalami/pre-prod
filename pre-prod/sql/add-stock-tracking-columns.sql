-- Add stock tracking columns to buybox_data table
-- These columns track SP-API offer counts to determine stock status

ALTER TABLE buybox_data 
ADD COLUMN IF NOT EXISTS your_offers_count INTEGER DEFAULT 0;

ALTER TABLE buybox_data 
ADD COLUMN IF NOT EXISTS total_offers_count INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN buybox_data.your_offers_count IS 'Number of your offers found in SP-API (0 = out of stock)';
COMMENT ON COLUMN buybox_data.total_offers_count IS 'Total number of offers for this ASIN in SP-API';

-- Add indexes for stock-based filtering
CREATE INDEX IF NOT EXISTS buybox_data_your_offers_count_idx ON buybox_data(your_offers_count);
CREATE INDEX IF NOT EXISTS buybox_data_total_offers_count_idx ON buybox_data(total_offers_count);

-- Create composite index for out-of-stock opportunities
CREATE INDEX IF NOT EXISTS buybox_data_stock_opportunities_idx ON buybox_data(your_offers_count, is_winner, opportunity_flag);

-- Update existing total_offers column to match new total_offers_count for consistency
UPDATE buybox_data 
SET total_offers_count = COALESCE(total_offers, 0) 
WHERE total_offers_count IS NULL;