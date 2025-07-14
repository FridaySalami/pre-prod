-- Add margin analysis columns to buybox_data table
-- Run this SQL in your Supabase SQL editor

ALTER TABLE buybox_data 
ADD COLUMN IF NOT EXISTS your_cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS your_shipping_cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS your_material_total_cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS your_box_cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS your_vat_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS your_fragile_charge DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS material_cost_only DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS total_operating_cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS material_cost_breakdown TEXT,
ADD COLUMN IF NOT EXISTS operating_cost_breakdown TEXT,
ADD COLUMN IF NOT EXISTS breakeven_calculation TEXT,
ADD COLUMN IF NOT EXISTS your_margin_at_current_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS your_margin_percent_at_current_price DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS margin_at_buybox_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS margin_percent_at_buybox_price DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS margin_difference DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS profit_opportunity DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS current_actual_profit DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS buybox_actual_profit DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS current_profit_breakdown TEXT,
ADD COLUMN IF NOT EXISTS buybox_profit_breakdown TEXT,
ADD COLUMN IF NOT EXISTS recommended_action VARCHAR(50),
ADD COLUMN IF NOT EXISTS price_adjustment_needed DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS break_even_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS margin_calculation_version VARCHAR(20),
ADD COLUMN IF NOT EXISTS cost_data_source VARCHAR(20);

-- Add indexes for better query performance on key columns
CREATE INDEX IF NOT EXISTS idx_buybox_data_recommended_action ON buybox_data(recommended_action);
CREATE INDEX IF NOT EXISTS idx_buybox_data_profit_opportunity ON buybox_data(profit_opportunity);
CREATE INDEX IF NOT EXISTS idx_buybox_data_margin_percent ON buybox_data(your_margin_percent_at_current_price);
CREATE INDEX IF NOT EXISTS idx_buybox_data_cost_source ON buybox_data(cost_data_source);

-- Verify the columns were added successfully
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'buybox_data' 
AND column_name IN (
  'breakeven_calculation', 
  'recommended_action', 
  'profit_opportunity',
  'current_actual_profit',
  'total_operating_cost'
)
ORDER BY column_name;
