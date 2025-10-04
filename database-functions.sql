-- Database functions for enhanced sales analytics

-- Function to get product trends
CREATE OR REPLACE FUNCTION get_product_trends(
    months_back INTEGER DEFAULT 6,
    search_term TEXT DEFAULT '',
    search_type TEXT DEFAULT 'all',
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    sku TEXT,
    current_month_data JSONB,
    previous_month_data JSONB,
    units_trend NUMERIC,
    revenue_trend NUMERIC,
    sessions_trend NUMERIC,
    buy_box_trend NUMERIC,
    trend_direction TEXT
) AS $$
DECLARE
    latest_month DATE;
    previous_month DATE;
BEGIN
    -- Get the latest and previous month dates
    SELECT MAX(reporting_month) INTO latest_month FROM historical_sales_data;
    SELECT MAX(reporting_month) INTO previous_month 
    FROM historical_sales_data 
    WHERE reporting_month < latest_month;

    RETURN QUERY
    WITH current_data AS (
        SELECT 
            h.sku,
            jsonb_build_object(
                'sku', h.sku,
                'title', h.title,
                'units_ordered', h.units_ordered,
                'ordered_product_sales', h.ordered_product_sales,
                'sessions_total', h.sessions_total,
                'buy_box_percentage', h.buy_box_percentage
            ) as data
        FROM historical_sales_data h
        WHERE h.reporting_month = latest_month
    ),
    previous_data AS (
        SELECT 
            h.sku,
            jsonb_build_object(
                'sku', h.sku,
                'title', h.title,
                'units_ordered', h.units_ordered,
                'ordered_product_sales', h.ordered_product_sales,
                'sessions_total', h.sessions_total,
                'buy_box_percentage', h.buy_box_percentage
            ) as data
        FROM historical_sales_data h
        WHERE h.reporting_month = previous_month
    ),
    trends AS (
        SELECT 
            c.sku,
            c.data as current_data,
            COALESCE(p.data, jsonb_build_object()) as previous_data,
            CASE 
                WHEN (p.data->>'units_ordered')::NUMERIC > 0 
                THEN ((c.data->>'units_ordered')::NUMERIC - (p.data->>'units_ordered')::NUMERIC) / (p.data->>'units_ordered')::NUMERIC * 100
                ELSE 0 
            END as units_trend,
            CASE 
                WHEN (p.data->>'ordered_product_sales')::NUMERIC > 0 
                THEN ((c.data->>'ordered_product_sales')::NUMERIC - (p.data->>'ordered_product_sales')::NUMERIC) / (p.data->>'ordered_product_sales')::NUMERIC * 100
                ELSE 0 
            END as revenue_trend,
            CASE 
                WHEN (p.data->>'sessions_total')::NUMERIC > 0 
                THEN ((c.data->>'sessions_total')::NUMERIC - (p.data->>'sessions_total')::NUMERIC) / (p.data->>'sessions_total')::NUMERIC * 100
                ELSE 0 
            END as sessions_trend,
            (c.data->>'buy_box_percentage')::NUMERIC - COALESCE((p.data->>'buy_box_percentage')::NUMERIC, 0) as buy_box_trend
        FROM current_data c
        LEFT JOIN previous_data p ON c.sku = p.sku
        WHERE (
            search_term = '' OR
            (search_type = 'sku' AND c.sku ILIKE '%' || search_term || '%') OR
            (search_type = 'title' AND c.data->>'title' ILIKE '%' || search_term || '%') OR
            (search_type = 'all' AND (
                c.sku ILIKE '%' || search_term || '%' OR 
                c.data->>'title' ILIKE '%' || search_term || '%'
            ))
        )
        ORDER BY (c.data->>'ordered_product_sales')::NUMERIC DESC
        LIMIT limit_count OFFSET offset_count
    )
    SELECT 
        t.sku::TEXT,
        t.current_data,
        t.previous_data,
        t.units_trend,
        t.revenue_trend,
        t.sessions_trend,
        t.buy_box_trend,
        CASE 
            WHEN t.revenue_trend > 10 THEN 'strong_growth'
            WHEN t.revenue_trend > 0 THEN 'growth'
            WHEN t.revenue_trend < -10 THEN 'decline'
            WHEN t.revenue_trend < 0 THEN 'slight_decline'
            ELSE 'stable'
        END::TEXT as trend_direction
    FROM trends t;
END;
$$ LANGUAGE plpgsql;

-- Function to get top performers
CREATE OR REPLACE FUNCTION get_top_performers(
    months_back INTEGER DEFAULT 6,
    metric TEXT DEFAULT 'revenue'
)
RETURNS TABLE (
    sku TEXT,
    title TEXT,
    total_units INTEGER,
    total_revenue NUMERIC,
    avg_sessions NUMERIC,
    avg_buy_box NUMERIC,
    performance_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.sku::TEXT,
        h.title::TEXT,
        SUM(h.units_ordered)::INTEGER as total_units,
        SUM(h.ordered_product_sales)::NUMERIC as total_revenue,
        AVG(h.sessions_total)::NUMERIC as avg_sessions,
        AVG(h.buy_box_percentage)::NUMERIC as avg_buy_box,
        (SUM(h.ordered_product_sales) * 0.5 + SUM(h.units_ordered) * 0.3 + AVG(h.buy_box_percentage) * 0.2)::NUMERIC as performance_score
    FROM historical_sales_data h
    WHERE h.reporting_month >= (SELECT MAX(reporting_month) FROM historical_sales_data) - INTERVAL '%s months'::text
    GROUP BY h.sku, h.title
    ORDER BY 
        CASE 
            WHEN metric = 'revenue' THEN SUM(h.ordered_product_sales)
            WHEN metric = 'units' THEN SUM(h.units_ordered)
            WHEN metric = 'sessions' THEN AVG(h.sessions_total)
            ELSE SUM(h.ordered_product_sales)
        END DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Function to get bottom performers (for improvement opportunities)
CREATE OR REPLACE FUNCTION get_bottom_performers(
    months_back INTEGER DEFAULT 6,
    metric TEXT DEFAULT 'revenue'
)
RETURNS TABLE (
    sku TEXT,
    title TEXT,
    total_units INTEGER,
    total_revenue NUMERIC,
    avg_sessions NUMERIC,
    avg_buy_box NUMERIC,
    improvement_opportunities TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    WITH bottom_products AS (
        SELECT 
            h.sku,
            h.title,
            SUM(h.units_ordered) as total_units,
            SUM(h.ordered_product_sales) as total_revenue,
            AVG(h.sessions_total) as avg_sessions,
            AVG(h.buy_box_percentage) as avg_buy_box
        FROM historical_sales_data h
        WHERE h.reporting_month >= (SELECT MAX(reporting_month) FROM historical_sales_data) - INTERVAL '%s months'::text
        GROUP BY h.sku, h.title
        HAVING SUM(h.units_ordered) > 0  -- Only products with some sales
        ORDER BY 
            CASE 
                WHEN metric = 'revenue' THEN SUM(h.ordered_product_sales)
                WHEN metric = 'units' THEN SUM(h.units_ordered)
                WHEN metric = 'sessions' THEN AVG(h.sessions_total)
                ELSE SUM(h.ordered_product_sales)
            END ASC
        LIMIT 10
    )
    SELECT 
        bp.sku::TEXT,
        bp.title::TEXT,
        bp.total_units::INTEGER,
        bp.total_revenue::NUMERIC,
        bp.avg_sessions::NUMERIC,
        bp.avg_buy_box::NUMERIC,
        ARRAY[
            CASE WHEN bp.avg_buy_box < 50 THEN 'Improve Buy Box ownership' ELSE NULL END,
            CASE WHEN bp.avg_sessions > 100 AND bp.total_units < 10 THEN 'Low conversion rate - optimize listing' ELSE NULL END,
            CASE WHEN bp.avg_sessions < 50 THEN 'Low visibility - improve SEO/advertising' ELSE NULL END
        ]::TEXT[] as improvement_opportunities
    FROM bottom_products bp;
END;
$$ LANGUAGE plpgsql;

-- Function to get monthly comparison data
CREATE OR REPLACE FUNCTION get_monthly_comparison(
    months_back INTEGER DEFAULT 12
)
RETURNS TABLE (
    reporting_month DATE,
    total_products INTEGER,
    total_units INTEGER,
    total_revenue NUMERIC,
    total_sessions INTEGER,
    avg_buy_box_percentage NUMERIC,
    month_over_month_growth NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH monthly_data AS (
        SELECT 
            h.reporting_month,
            COUNT(*)::INTEGER as total_products,
            SUM(h.units_ordered)::INTEGER as total_units,
            SUM(h.ordered_product_sales)::NUMERIC as total_revenue,
            SUM(h.sessions_total)::INTEGER as total_sessions,
            AVG(h.buy_box_percentage)::NUMERIC as avg_buy_box_percentage
        FROM historical_sales_data h
        WHERE h.reporting_month >= (SELECT MAX(reporting_month) FROM historical_sales_data) - INTERVAL '%s months'::text
        GROUP BY h.reporting_month
        ORDER BY h.reporting_month
    ),
    with_growth AS (
        SELECT 
            *,
            CASE 
                WHEN LAG(total_revenue) OVER (ORDER BY reporting_month) > 0 
                THEN ((total_revenue - LAG(total_revenue) OVER (ORDER BY reporting_month)) / LAG(total_revenue) OVER (ORDER BY reporting_month) * 100)
                ELSE 0 
            END as month_over_month_growth
        FROM monthly_data
    )
    SELECT * FROM with_growth;
END;
$$ LANGUAGE plpgsql;

-- Function to increment check_count for price monitoring config
CREATE OR REPLACE FUNCTION increment_check_count(config_id INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE price_monitoring_config 
    SET check_count = check_count + 1 
    WHERE id = config_id;
END;
$$ LANGUAGE plpgsql;
