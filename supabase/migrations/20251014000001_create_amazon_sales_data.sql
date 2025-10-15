-- Amazon Sales & Traffic Data Table
-- Stores daily sales/traffic metrics from Amazon Reports API
-- Report Type: GET_SALES_AND_TRAFFIC_REPORT

CREATE TABLE IF NOT EXISTS amazon_sales_data (
  id SERIAL PRIMARY KEY,
  asin VARCHAR(10) NOT NULL,
  parent_asin VARCHAR(10), -- For variations
  sku VARCHAR(100),
  report_date DATE NOT NULL,
  
  -- Sales Metrics
  ordered_units INTEGER DEFAULT 0,
  ordered_product_sales DECIMAL(10,2) DEFAULT 0.00,
  total_order_items INTEGER DEFAULT 0,
  
  -- Traffic Metrics
  sessions INTEGER DEFAULT 0,
  session_percentage DECIMAL(5,2),
  page_views INTEGER DEFAULT 0,
  page_views_percentage DECIMAL(5,2),
  
  -- Conversion Metrics
  unit_session_percentage DECIMAL(5,2), -- Conversion rate
  buy_box_percentage DECIMAL(5,2),
  
  -- Other Metrics
  average_sales_price DECIMAL(10,2),
  average_offer_count INTEGER,
  
  -- Metadata
  marketplace_id VARCHAR(20) DEFAULT 'A1F83G8C2ARO7P', -- UK marketplace
  currency_code VARCHAR(3) DEFAULT 'GBP',
  report_id VARCHAR(100),
  imported_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure unique records per ASIN per day
  UNIQUE(asin, report_date, marketplace_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_asin_date ON amazon_sales_data(asin, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_date ON amazon_sales_data(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_asin ON amazon_sales_data(asin);
CREATE INDEX IF NOT EXISTS idx_sales_parent_asin ON amazon_sales_data(parent_asin) WHERE parent_asin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_report_id ON amazon_sales_data(report_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_amazon_sales_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER amazon_sales_data_updated_at
  BEFORE UPDATE ON amazon_sales_data
  FOR EACH ROW
  EXECUTE FUNCTION update_amazon_sales_data_updated_at();

-- Comments for documentation
COMMENT ON TABLE amazon_sales_data IS 'Daily sales and traffic metrics from Amazon Reports API';
COMMENT ON COLUMN amazon_sales_data.asin IS 'Product ASIN';
COMMENT ON COLUMN amazon_sales_data.report_date IS 'Date of the sales data';
COMMENT ON COLUMN amazon_sales_data.ordered_units IS 'Number of units ordered';
COMMENT ON COLUMN amazon_sales_data.ordered_product_sales IS 'Total revenue for the day';
COMMENT ON COLUMN amazon_sales_data.sessions IS 'Number of sessions (visits)';
COMMENT ON COLUMN amazon_sales_data.unit_session_percentage IS 'Conversion rate (units/sessions * 100)';
COMMENT ON COLUMN amazon_sales_data.buy_box_percentage IS 'Buy Box win rate for the day';
