-- Optional: Create sample July data for testing
-- This creates a copy of June data with slight variations to simulate July performance

INSERT INTO historical_sales_data (
    reporting_month,
    sku,
    parent_asin,
    child_asin,
    title,
    units_ordered,
    ordered_product_sales,
    sessions_total,
    unit_session_percentage,
    buy_box_percentage
)
SELECT 
    '2024-07-01'::DATE as reporting_month,
    sku,
    parent_asin,
    child_asin,
    title,
    -- Add some randomness to simulate July performance
    GREATEST(0, units_ordered + FLOOR(RANDOM() * 10 - 5)) as units_ordered,
    GREATEST(0, ordered_product_sales * (0.9 + RANDOM() * 0.2)) as ordered_product_sales,
    GREATEST(0, sessions_total + FLOOR(RANDOM() * 100 - 50)) as sessions_total,
    GREATEST(0, LEAST(100, unit_session_percentage * (0.8 + RANDOM() * 0.4))) as unit_session_percentage,
    GREATEST(0, LEAST(100, buy_box_percentage * (0.9 + RANDOM() * 0.2))) as buy_box_percentage
FROM historical_sales_data 
WHERE reporting_month = '2024-06-01'
ON CONFLICT (reporting_month, sku) DO NOTHING;

-- Verify both months exist
SELECT 
    reporting_month,
    COUNT(*) as products,
    SUM(units_ordered) as total_units,
    SUM(ordered_product_sales) as total_revenue
FROM historical_sales_data 
GROUP BY reporting_month 
ORDER BY reporting_month;
