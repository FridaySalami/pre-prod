-- Add enhanced pricing analysis fields to buybox_data table
-- These fields support the new pricing clarity features

-- Begin transaction to ensure all changes are applied together
BEGIN;

-- Add enhanced pricing fields to the buybox_data table
ALTER TABLE buybox_data 
ADD COLUMN IF NOT EXISTS merchant_token TEXT,
ADD COLUMN IF NOT EXISTS buybox_merchant_token TEXT,

-- Enhanced pricing clarity fields
ADD COLUMN IF NOT EXISTS your_current_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS your_current_shipping NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS your_current_total NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS buybox_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS buybox_shipping NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS buybox_total NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS price_gap NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS price_gap_percentage NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS pricing_status TEXT,
ADD COLUMN IF NOT EXISTS your_offer_found BOOLEAN DEFAULT FALSE,

-- Cost analysis fields (from CostCalculator enrichment)
ADD COLUMN IF NOT EXISTS your_cost NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS your_shipping_cost NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS your_material_total_cost NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS your_box_cost NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS your_vat_amount NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS your_fragile_charge NUMERIC(10,2) DEFAULT 0,

-- Margin analysis fields
ADD COLUMN IF NOT EXISTS your_margin_at_current_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS your_margin_percent_at_current_price NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS margin_at_buybox_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS margin_percent_at_buybox_price NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS margin_difference NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS profit_opportunity NUMERIC(10,2),

-- Recommendation fields
ADD COLUMN IF NOT EXISTS recommended_action TEXT,
ADD COLUMN IF NOT EXISTS price_adjustment_needed NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS break_even_price NUMERIC(10,2),

-- Metadata fields
ADD COLUMN IF NOT EXISTS margin_calculation_version TEXT DEFAULT 'v1.0',
ADD COLUMN IF NOT EXISTS cost_data_source TEXT;

-- Add indexes for the new pricing fields to improve query performance
CREATE INDEX IF NOT EXISTS buybox_data_your_current_price_idx ON buybox_data(your_current_price);
CREATE INDEX IF NOT EXISTS buybox_data_buybox_price_idx ON buybox_data(buybox_price);
CREATE INDEX IF NOT EXISTS buybox_data_price_gap_idx ON buybox_data(price_gap);
CREATE INDEX IF NOT EXISTS buybox_data_pricing_status_idx ON buybox_data(pricing_status);
CREATE INDEX IF NOT EXISTS buybox_data_recommended_action_idx ON buybox_data(recommended_action);
CREATE INDEX IF NOT EXISTS buybox_data_your_offer_found_idx ON buybox_data(your_offer_found);

-- Add comments for documentation
COMMENT ON COLUMN buybox_data.merchant_token IS 'Your seller ID for Amazon';
COMMENT ON COLUMN buybox_data.buybox_merchant_token IS 'Seller ID of the current Buy Box owner';
COMMENT ON COLUMN buybox_data.your_current_price IS 'Your current listing price (excluding shipping)';
COMMENT ON COLUMN buybox_data.your_current_shipping IS 'Your current shipping cost';
COMMENT ON COLUMN buybox_data.your_current_total IS 'Your total price including shipping';
COMMENT ON COLUMN buybox_data.buybox_price IS 'Current Buy Box price (excluding shipping)';
COMMENT ON COLUMN buybox_data.buybox_shipping IS 'Current Buy Box shipping cost';
COMMENT ON COLUMN buybox_data.buybox_total IS 'Current Buy Box total price including shipping';
COMMENT ON COLUMN buybox_data.price_gap IS 'Difference between your price and Buy Box price (positive = you are higher)';
COMMENT ON COLUMN buybox_data.price_gap_percentage IS 'Price gap as percentage of your current price';
COMMENT ON COLUMN buybox_data.pricing_status IS 'Status: winning_buybox, priced_above_buybox, or priced_below_buybox';
COMMENT ON COLUMN buybox_data.your_offer_found IS 'Whether your offer was found in the marketplace';
COMMENT ON COLUMN buybox_data.your_margin_at_current_price IS 'Profit margin at your current price';
COMMENT ON COLUMN buybox_data.your_margin_percent_at_current_price IS 'Profit margin percentage at your current price';
COMMENT ON COLUMN buybox_data.margin_at_buybox_price IS 'Potential profit margin if you matched Buy Box price';
COMMENT ON COLUMN buybox_data.margin_percent_at_buybox_price IS 'Potential profit margin percentage if you matched Buy Box price';
COMMENT ON COLUMN buybox_data.recommended_action IS 'System recommendation: match_buybox, hold_price, not_profitable, investigate';

-- Commit the transaction
COMMIT;

-- Display success message
SELECT 'Enhanced pricing analysis fields added to buybox_data table successfully!' as message;
