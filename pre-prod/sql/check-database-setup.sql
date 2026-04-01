-- Safe migration script - only migrates data from tables that exist
-- Run this to check what tables are available and migrate accordingly

-- First, let's see what sales tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 'sales_%' 
AND table_schema = 'public';

-- Create the historical table if it doesn't exist
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

-- Check if we have any data in historical table already
SELECT 
    reporting_month, 
    COUNT(*) as product_count,
    SUM(units_ordered) as total_units,
    SUM(ordered_product_sales) as total_revenue
FROM historical_sales_data 
GROUP BY reporting_month 
ORDER BY reporting_month;
