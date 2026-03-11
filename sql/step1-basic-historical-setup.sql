-- Step 1: Simple database setup for historical analytics
-- Run this first to create the basic historical structure

-- Create historical sales table (simplified version)
CREATE TABLE IF NOT EXISTS historical_sales_data (
    id SERIAL PRIMARY KEY,
    reporting_month DATE NOT NULL,
    sku VARCHAR(100) NOT NULL,
    parent_asin VARCHAR(20),
    child_asin VARCHAR(20),
    title TEXT,
    units_ordered INTEGER DEFAULT 0,
    ordered_product_sales DECIMAL(10,2) DEFAULT 0,
    sessions_total INTEGER DEFAULT 0,
    unit_session_percentage DECIMAL(5,2) DEFAULT 0,
    buy_box_percentage DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(reporting_month, sku)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_historical_sales_month ON historical_sales_data(reporting_month);
CREATE INDEX IF NOT EXISTS idx_historical_sales_sku ON historical_sales_data(sku);

-- Migrate existing data from available sales tables
-- Only migrate data from tables that actually exist

-- Migrate June data (if table exists)
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
    '2024-06-01'::DATE as reporting_month,
    "SKU" as sku,
    "(Parent) ASIN" as parent_asin,
    "(Child) ASIN" as child_asin,
    "Title" as title,
    COALESCE("Units ordered", 0) as units_ordered,
    CASE 
        WHEN "Ordered Product Sales" ~ '^[£]?[0-9,]+\.?[0-9]*$' 
        THEN CAST(REPLACE(REPLACE("Ordered Product Sales", '£', ''), ',', '') AS DECIMAL(10,2))
        ELSE 0 
    END as ordered_product_sales,
    CASE 
        WHEN "Sessions – Total" ~ '^[0-9,]+$' 
        THEN CAST(REPLACE("Sessions – Total", ',', '') AS INTEGER)
        ELSE 0 
    END as sessions_total,
    CASE 
        WHEN "Unit Session Percentage" ~ '^[0-9,]+\.?[0-9]*%?$' 
        THEN CAST(REPLACE(REPLACE("Unit Session Percentage", '%', ''), ',', '') AS DECIMAL(5,2))
        ELSE 0 
    END as unit_session_percentage,
    CASE 
        WHEN "Featured Offer (Buy Box) percentage" ~ '^[0-9,]+\.?[0-9]*%?$' 
        THEN CAST(REPLACE(REPLACE("Featured Offer (Buy Box) percentage", '%', ''), ',', '') AS DECIMAL(5,2))
        ELSE 0 
    END as buy_box_percentage
FROM sales_june
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_june')
ON CONFLICT (reporting_month, sku) DO NOTHING;

-- Migrate July data (if table exists)
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
    "SKU" as sku,
    "(Parent) ASIN" as parent_asin,
    "(Child) ASIN" as child_asin,
    "Title" as title,
    COALESCE("Units ordered", 0) as units_ordered,
    CASE 
        WHEN "Ordered Product Sales" ~ '^[£]?[0-9,]+\.?[0-9]*$' 
        THEN CAST(REPLACE(REPLACE("Ordered Product Sales", '£', ''), ',', '') AS DECIMAL(10,2))
        ELSE 0 
    END as ordered_product_sales,
    CASE 
        WHEN "Sessions – Total" ~ '^[0-9,]+$' 
        THEN CAST(REPLACE("Sessions – Total", ',', '') AS INTEGER)
        ELSE 0 
    END as sessions_total,
    CASE 
        WHEN "Unit Session Percentage" ~ '^[0-9,]+\.?[0-9]*%?$' 
        THEN CAST(REPLACE(REPLACE("Unit Session Percentage", '%', ''), ',', '') AS DECIMAL(5,2))
        ELSE 0 
    END as unit_session_percentage,
    CASE 
        WHEN "Featured Offer (Buy Box) percentage" ~ '^[0-9,]+\.?[0-9]*%?$' 
        THEN CAST(REPLACE(REPLACE("Featured Offer (Buy Box) percentage", '%', ''), ',', '') AS DECIMAL(5,2))
        ELSE 0 
    END as buy_box_percentage
FROM sales_july
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_july')
ON CONFLICT (reporting_month, sku) DO NOTHING;

-- Migrate May data (if table exists)
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
    '2024-05-01'::DATE as reporting_month,
    "SKU" as sku,
    "(Parent) ASIN" as parent_asin,
    "(Child) ASIN" as child_asin,
    "Title" as title,
    COALESCE("Units ordered", 0) as units_ordered,
    CASE 
        WHEN "Ordered Product Sales" ~ '^[£]?[0-9,]+\.?[0-9]*$' 
        THEN CAST(REPLACE(REPLACE("Ordered Product Sales", '£', ''), ',', '') AS DECIMAL(10,2))
        ELSE 0 
    END as ordered_product_sales,
    CASE 
        WHEN "Sessions – Total" ~ '^[0-9,]+$' 
        THEN CAST(REPLACE("Sessions – Total", ',', '') AS INTEGER)
        ELSE 0 
    END as sessions_total,
    CASE 
        WHEN "Unit Session Percentage" ~ '^[0-9,]+\.?[0-9]*%?$' 
        THEN CAST(REPLACE(REPLACE("Unit Session Percentage", '%', ''), ',', '') AS DECIMAL(5,2))
        ELSE 0 
    END as unit_session_percentage,
    CASE 
        WHEN "Featured Offer (Buy Box) percentage" ~ '^[0-9,]+\.?[0-9]*%?$' 
        THEN CAST(REPLACE(REPLACE("Featured Offer (Buy Box) percentage", '%', ''), ',', '') AS DECIMAL(5,2))
        ELSE 0 
    END as buy_box_percentage
FROM sales_may
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_may')
ON CONFLICT (reporting_month, sku) DO NOTHING;
