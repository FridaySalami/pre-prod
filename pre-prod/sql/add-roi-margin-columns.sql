-- Migration: Add ROI-based margin calculation columns to buybox_data table
-- Date: July 2025
-- Description: Adds columns to store detailed ROI margin calculations and breakdowns

-- Add new columns for ROI-based margin calculations
ALTER TABLE buybox_data 
ADD COLUMN IF NOT EXISTS current_margin_calculation TEXT,
ADD COLUMN IF NOT EXISTS buybox_margin_calculation TEXT,
ADD COLUMN IF NOT EXISTS total_investment_current NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS total_investment_buybox NUMERIC(10, 2);

-- Add comments for documentation
COMMENT ON COLUMN buybox_data.current_margin_calculation IS 'Detailed breakdown of ROI margin calculation for current price: (Profit ÷ Total Investment) × 100';
COMMENT ON COLUMN buybox_data.buybox_margin_calculation IS 'Detailed breakdown of ROI margin calculation for buy box price: (Profit ÷ Total Investment) × 100';
COMMENT ON COLUMN buybox_data.total_investment_current IS 'Total investment amount (costs + fees) for current price';
COMMENT ON COLUMN buybox_data.total_investment_buybox IS 'Total investment amount (costs + fees) for buy box price';

-- Create indexes for the new numeric columns (calculation strings don't need indexes)
CREATE INDEX IF NOT EXISTS buybox_data_total_investment_current_idx ON buybox_data(total_investment_current);
CREATE INDEX IF NOT EXISTS buybox_data_total_investment_buybox_idx ON buybox_data(total_investment_buybox);

-- Update the table comment to reflect the new ROI calculation method
COMMENT ON TABLE buybox_data IS 'Stores results of Buy Box checks for all monitored ASINs with ROI-based margin calculations (Profit ÷ Total Investment)';

-- Optionally, you can also create a view that shows the difference between old and new calculation methods
-- This is useful for comparison during the transition period
CREATE OR REPLACE VIEW buybox_margin_comparison AS
SELECT 
    id,
    asin,
    sku,
    -- Traditional margin % (if you want to compare)
    CASE 
        WHEN price > 0 AND margin_at_buybox IS NOT NULL 
        THEN ROUND((margin_at_buybox / price) * 100, 2)
        ELSE NULL 
    END AS traditional_margin_percent,
    
    -- New ROI margin %
    margin_percent_at_buybox as roi_margin_percent,
    
    -- Investment amounts
    total_investment_current,
    total_investment_buybox,
    
    -- Calculation breakdowns
    current_margin_calculation,
    buybox_margin_calculation,
    
    captured_at
FROM buybox_data
WHERE margin_at_buybox IS NOT NULL
ORDER BY captured_at DESC;

COMMENT ON VIEW buybox_margin_comparison IS 'Comparison view showing traditional vs ROI-based margin calculations';
