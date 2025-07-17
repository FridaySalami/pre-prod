#!/bin/bash

# Enhanced Sales Analytics Database Migration Script
# This script migrates existing monthly sales tables to the new historical structure

echo "🚀 Starting Enhanced Sales Analytics Migration..."

# Create the new enhanced tables
echo "📋 Creating enhanced database structure..."
psql "$DATABASE_URL" -f database-improvements.sql

# Migration function to copy data from monthly tables to historical table
echo "📊 Migrating existing sales data..."

# Array of months to migrate (add more as needed)
declare -a months=("june" "july")
declare -a month_dates=("2024-06-01" "2024-07-01")

for i in "${!months[@]}"; do
    month="${months[$i]}"
    month_date="${month_dates[$i]}"
    table_name="sales_${month}"
    
    echo "📥 Migrating data from ${table_name}..."
    
    # Check if table exists
    table_exists=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='${table_name}');")
    
    if [[ $table_exists == "t" ]]; then
        # Migrate data with proper field mapping
        psql "$DATABASE_URL" << EOF
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
    buy_box_percentage,
    sessions_mobile,
    sessions_browser,
    page_views_total
)
SELECT 
    '${month_date}'::DATE as reporting_month,
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
    END as buy_box_percentage,
    CASE 
        WHEN "Sessions – Mobile app" ~ '^[0-9,]+$' 
        THEN CAST(REPLACE("Sessions – Mobile app", ',', '') AS INTEGER)
        ELSE 0 
    END as sessions_mobile,
    CASE 
        WHEN "Sessions – Browser" ~ '^[0-9,]+$' 
        THEN CAST(REPLACE("Sessions – Browser", ',', '') AS INTEGER)
        ELSE 0 
    END as sessions_browser,
    CASE 
        WHEN "Page views – Total" ~ '^[0-9,]+$' 
        THEN CAST(REPLACE("Page views – Total", ',', '') AS INTEGER)
        ELSE 0 
    END as page_views_total
FROM ${table_name}
ON CONFLICT (reporting_month, sku) DO UPDATE SET
    units_ordered = EXCLUDED.units_ordered,
    ordered_product_sales = EXCLUDED.ordered_product_sales,
    sessions_total = EXCLUDED.sessions_total,
    unit_session_percentage = EXCLUDED.unit_session_percentage,
    buy_box_percentage = EXCLUDED.buy_box_percentage,
    sessions_mobile = EXCLUDED.sessions_mobile,
    sessions_browser = EXCLUDED.sessions_browser,
    page_views_total = EXCLUDED.page_views_total,
    updated_at = NOW();
EOF
        echo "✅ Successfully migrated ${table_name}"
    else
        echo "⚠️  Table ${table_name} does not exist, skipping..."
    fi
done

# Generate monthly summaries
echo "📈 Generating monthly summaries..."
psql "$DATABASE_URL" << 'EOF'
INSERT INTO monthly_sales_summary (
    reporting_month,
    total_products,
    total_units,
    total_revenue,
    total_sessions,
    avg_buy_box_percentage,
    products_with_sales,
    products_without_sales,
    top_performing_sku
)
SELECT 
    reporting_month,
    COUNT(*) as total_products,
    SUM(units_ordered) as total_units,
    SUM(ordered_product_sales) as total_revenue,
    SUM(sessions_total) as total_sessions,
    AVG(buy_box_percentage) as avg_buy_box_percentage,
    COUNT(*) FILTER (WHERE units_ordered > 0) as products_with_sales,
    COUNT(*) FILTER (WHERE units_ordered = 0) as products_without_sales,
    (SELECT sku FROM historical_sales_data h2 
     WHERE h2.reporting_month = h1.reporting_month 
     ORDER BY ordered_product_sales DESC LIMIT 1) as top_performing_sku
FROM historical_sales_data h1
GROUP BY reporting_month
ON CONFLICT (reporting_month) DO UPDATE SET
    total_products = EXCLUDED.total_products,
    total_units = EXCLUDED.total_units,
    total_revenue = EXCLUDED.total_revenue,
    total_sessions = EXCLUDED.total_sessions,
    avg_buy_box_percentage = EXCLUDED.avg_buy_box_percentage,
    products_with_sales = EXCLUDED.products_with_sales,
    products_without_sales = EXCLUDED.products_without_sales,
    top_performing_sku = EXCLUDED.top_performing_sku,
    updated_at = NOW();
EOF

# Generate performance trends
echo "📊 Calculating performance trends..."
psql "$DATABASE_URL" << 'EOF'
-- Calculate trends for each product across months
WITH monthly_ranks AS (
    SELECT 
        sku,
        reporting_month,
        units_ordered,
        ordered_product_sales,
        sessions_total,
        buy_box_percentage,
        ROW_NUMBER() OVER (PARTITION BY reporting_month ORDER BY units_ordered DESC) as units_rank,
        ROW_NUMBER() OVER (PARTITION BY reporting_month ORDER BY ordered_product_sales DESC) as revenue_rank,
        LAG(units_ordered) OVER (PARTITION BY sku ORDER BY reporting_month) as prev_units,
        LAG(ordered_product_sales) OVER (PARTITION BY sku ORDER BY reporting_month) as prev_revenue,
        LAG(sessions_total) OVER (PARTITION BY sku ORDER BY reporting_month) as prev_sessions,
        LAG(buy_box_percentage) OVER (PARTITION BY sku ORDER BY reporting_month) as prev_buy_box
    FROM historical_sales_data
),
trend_calculations AS (
    SELECT 
        sku,
        reporting_month,
        units_rank,
        revenue_rank,
        CASE 
            WHEN prev_units IS NULL THEN 'new'
            WHEN units_ordered > prev_units * 1.1 THEN 'up'
            WHEN units_ordered < prev_units * 0.9 THEN 'down'
            ELSE 'stable'
        END as units_trend,
        CASE 
            WHEN prev_revenue IS NULL THEN 'new'
            WHEN ordered_product_sales > prev_revenue * 1.1 THEN 'up'
            WHEN ordered_product_sales < prev_revenue * 0.9 THEN 'down'
            ELSE 'stable'
        END as revenue_trend,
        CASE 
            WHEN prev_sessions IS NULL THEN 'new'
            WHEN sessions_total > prev_sessions * 1.1 THEN 'up'
            WHEN sessions_total < prev_sessions * 0.9 THEN 'down'
            ELSE 'stable'
        END as sessions_trend,
        CASE 
            WHEN prev_buy_box IS NULL THEN 'new'
            WHEN buy_box_percentage > prev_buy_box + 5 THEN 'up'
            WHEN buy_box_percentage < prev_buy_box - 5 THEN 'down'
            ELSE 'stable'
        END as buy_box_trend,
        -- Calculate composite performance score
        (units_ordered * 0.3 + ordered_product_sales * 0.4 + sessions_total * 0.2 + buy_box_percentage * 0.1) as performance_score
    FROM monthly_ranks
)
INSERT INTO product_performance_trends (
    sku,
    reporting_month,
    rank_by_units,
    rank_by_revenue,
    units_trend,
    revenue_trend,
    sessions_trend,
    buy_box_trend,
    performance_score
)
SELECT 
    sku,
    reporting_month,
    units_rank,
    revenue_rank,
    units_trend,
    revenue_trend,
    sessions_trend,
    buy_box_trend,
    performance_score
FROM trend_calculations
ON CONFLICT (sku, reporting_month) DO UPDATE SET
    rank_by_units = EXCLUDED.rank_by_units,
    rank_by_revenue = EXCLUDED.rank_by_revenue,
    units_trend = EXCLUDED.units_trend,
    revenue_trend = EXCLUDED.revenue_trend,
    sessions_trend = EXCLUDED.sessions_trend,
    buy_box_trend = EXCLUDED.buy_box_trend,
    performance_score = EXCLUDED.performance_score;
EOF

echo "🎉 Migration completed successfully!"
echo "📋 Summary:"
echo "   ✅ Enhanced database structure created"
echo "   ✅ Historical data migrated from monthly tables"
echo "   ✅ Monthly summaries generated"
echo "   ✅ Performance trends calculated"
echo ""
echo "🚀 You can now use the enhanced sales analytics dashboard!"
echo "   📊 Current month analysis with trends"
echo "   📈 Monthly comparison charts"
echo "   🎯 Performance insights and recommendations"
echo "   🔍 Advanced search and filtering"
