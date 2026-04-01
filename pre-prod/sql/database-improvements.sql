-- Enhanced Database Structure for Historical Sales Analytics

-- 1. Create a unified historical sales table
CREATE TABLE IF NOT EXISTS historical_sales_data (
    id SERIAL PRIMARY KEY,
    reporting_month DATE NOT NULL, -- First day of reporting month (e.g., 2024-06-01)
    sku VARCHAR(100) NOT NULL,
    parent_asin VARCHAR(20),
    child_asin VARCHAR(20),
    title TEXT,
    units_ordered INTEGER DEFAULT 0,
    ordered_product_sales DECIMAL(10,2) DEFAULT 0,
    sessions_total INTEGER DEFAULT 0,
    unit_session_percentage DECIMAL(5,2) DEFAULT 0,
    buy_box_percentage DECIMAL(5,2) DEFAULT 0,
    sessions_mobile INTEGER DEFAULT 0,
    sessions_browser INTEGER DEFAULT 0,
    page_views_total INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(reporting_month, sku)
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_historical_sales_month ON historical_sales_data(reporting_month);
CREATE INDEX IF NOT EXISTS idx_historical_sales_sku ON historical_sales_data(sku);
CREATE INDEX IF NOT EXISTS idx_historical_sales_asin ON historical_sales_data(child_asin);
CREATE INDEX IF NOT EXISTS idx_historical_sales_performance ON historical_sales_data(units_ordered DESC, ordered_product_sales DESC);

-- 3. Create a view for latest month data (maintains compatibility)
CREATE OR REPLACE VIEW latest_month_sales AS
SELECT * FROM historical_sales_data 
WHERE reporting_month = (SELECT MAX(reporting_month) FROM historical_sales_data);

-- 4. Create monthly summary table for quick aggregations
CREATE TABLE IF NOT EXISTS monthly_sales_summary (
    id SERIAL PRIMARY KEY,
    reporting_month DATE NOT NULL UNIQUE,
    total_products INTEGER DEFAULT 0,
    total_units INTEGER DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    avg_buy_box_percentage DECIMAL(5,2) DEFAULT 0,
    products_with_sales INTEGER DEFAULT 0,
    products_without_sales INTEGER DEFAULT 0,
    top_performing_sku VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Create product performance trends table
CREATE TABLE IF NOT EXISTS product_performance_trends (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) NOT NULL,
    reporting_month DATE NOT NULL,
    rank_by_units INTEGER,
    rank_by_revenue INTEGER,
    units_trend VARCHAR(20), -- 'up', 'down', 'stable', 'new'
    revenue_trend VARCHAR(20),
    sessions_trend VARCHAR(20),
    buy_box_trend VARCHAR(20),
    performance_score DECIMAL(5,2), -- Composite score
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(sku, reporting_month)
);
