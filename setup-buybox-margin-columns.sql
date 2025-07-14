-- Add margin analysis columns to buybox_data table
-- Run this in Supabase SQL Editor

ALTER TABLE buybox_data ADD COLUMN IF NOT EXISTS your_cost DECIMAL(10,2);
ALTER TABLE buybox_data ADD COLUMN IF NOT EXISTS your_shipping_cost DECIMAL(10,2);
ALTER TABLE buybox_data ADD COLUMN IF NOT EXISTS your_material_total_cost DECIMAL(10,2);
ALTER TABLE buybox_data ADD COLUMN IF NOT EXISTS your_box_cost DECIMAL(10,2);
ALTER TABLE buybox_data ADD COLUMN IF NOT EXISTS your_vat_amount DECIMAL(10,2);
ALTER TABLE buybox_data ADD COLUMN IF NOT EXISTS your_fragile_charge DECIMAL(10,2);

-- Current pricing margins
ALTER TABLE buybox_data ADD COLUMN IF NOT EXISTS your_margin_at_current_price DECIMAL(10,2);
ALTER TABLE buybox_data ADD COLUMN IF NOT EXISTS your_margin_percent_at_current_price DECIMAL(5,2);

-- Competitor analysis
ALTER TABLE buybox_data ADD COLUMN IF NOT EXISTS margin_at_buybox_price DECIMAL(10,2);
ALTER TABLE buybox_data ADD COLUMN IF NOT EXISTS margin_percent_at_buybox_price DECIMAL(5,2);
ALTER TABLE buybox_data ADD COLUMN IF NOT EXISTS margin_difference DECIMAL(10,2);
ALTER TABLE buybox_data ADD COLUMN IF NOT EXISTS profit_opportunity DECIMAL(10,2);

-- Recommendations
ALTER TABLE buybox_data ADD COLUMN IF NOT EXISTS recommended_action VARCHAR(50);
ALTER TABLE buybox_data ADD COLUMN IF NOT EXISTS price_adjustment_needed DECIMAL(10,2);
ALTER TABLE buybox_data ADD COLUMN IF NOT EXISTS break_even_price DECIMAL(10,2);

-- Metadata
ALTER TABLE buybox_data ADD COLUMN IF NOT EXISTS margin_calculation_version VARCHAR(10) DEFAULT 'v1.0';
ALTER TABLE buybox_data ADD COLUMN IF NOT EXISTS cost_data_source VARCHAR(50);

-- Add index for margin-based queries
CREATE INDEX IF NOT EXISTS idx_buybox_margin_opportunity ON buybox_data(margin_at_buybox_price DESC, is_winner);
CREATE INDEX IF NOT EXISTS idx_buybox_recommended_action ON buybox_data(recommended_action, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_buybox_profit_opportunity ON buybox_data(profit_opportunity DESC) WHERE profit_opportunity > 0;

-- Add comments for documentation
COMMENT ON COLUMN buybox_data.your_cost IS 'Base cost from Linnworks composition data';
COMMENT ON COLUMN buybox_data.margin_at_buybox_price IS 'Profit margin if we matched the current buy box price';
COMMENT ON COLUMN buybox_data.recommended_action IS 'match_buybox, hold_price, investigate, not_profitable';
COMMENT ON COLUMN buybox_data.profit_opportunity IS 'Additional profit possible if matching buy box price';
