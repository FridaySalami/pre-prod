-- Sales Dashboard Aggregation View
-- This creates a materialized view for fast dashboard queries
-- Run this once to set up the view, then refresh it daily via cron

-- Drop existing view if it exists
DROP MATERIALIZED VIEW IF EXISTS sales_dashboard_30d CASCADE;

-- Create materialized view with 30-day aggregation
CREATE MATERIALIZED VIEW sales_dashboard_30d AS
SELECT 
  asin,
  parent_asin,
  SUM(ordered_product_sales) as total_revenue,
  SUM(ordered_units) as total_units,
  SUM(sessions) as total_sessions,
  SUM(page_views) as total_page_views,
  AVG(buy_box_percentage) as avg_buy_box,
  AVG(unit_session_percentage) as avg_conversion,
  COUNT(*) as days_with_data,
  CASE 
    WHEN SUM(ordered_units) > 0 
    THEN SUM(ordered_product_sales) / SUM(ordered_units) 
    ELSE 0 
  END as avg_price,
  MIN(report_date) as first_sale_date,
  MAX(report_date) as last_sale_date
FROM amazon_sales_data
WHERE report_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY asin, parent_asin;

-- Create indexes for fast sorting and filtering
CREATE INDEX idx_sales_dashboard_revenue ON sales_dashboard_30d(total_revenue DESC);
CREATE INDEX idx_sales_dashboard_units ON sales_dashboard_30d(total_units DESC);
CREATE INDEX idx_sales_dashboard_sessions ON sales_dashboard_30d(total_sessions DESC);
CREATE INDEX idx_sales_dashboard_conversion ON sales_dashboard_30d(avg_conversion DESC);
CREATE INDEX idx_sales_dashboard_buybox ON sales_dashboard_30d(avg_buy_box DESC);
CREATE INDEX idx_sales_dashboard_asin ON sales_dashboard_30d(asin);

-- Grant access
GRANT SELECT ON sales_dashboard_30d TO authenticated;
GRANT SELECT ON sales_dashboard_30d TO anon;

-- Create function to refresh the view (call this daily via cron)
CREATE OR REPLACE FUNCTION refresh_sales_dashboard()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY sales_dashboard_30d;
END;
$$ LANGUAGE plpgsql;

COMMENT ON MATERIALIZED VIEW sales_dashboard_30d IS 
  'Aggregated sales data for last 30 days. Refreshed daily at midnight.';
COMMENT ON FUNCTION refresh_sales_dashboard() IS 
  'Refreshes the sales_dashboard_30d materialized view. Run daily via cron.';
