-- Check results from the latest production test run
-- Run this in Supabase SQL Editor to see what data was captured

-- 1. Check the job that just completed
SELECT 
    id,
    status,
    total_asins,
    successful_asins,
    failed_asins,
    source,
    started_at,
    completed_at
FROM buybox_jobs 
WHERE source = 'production_test_real_api_only'
ORDER BY started_at DESC 
LIMIT 1;

-- 2. Check buybox_data entries from this job
SELECT 
    run_id,
    asin,
    sku,
    current_price,
    has_buybox,
    buybox_seller,
    competitor_count,
    created_at
FROM buybox_data 
WHERE run_id = (
    SELECT id FROM buybox_jobs 
    WHERE source = 'production_test_real_api_only'
    ORDER BY started_at DESC 
    LIMIT 1
)
ORDER BY created_at DESC;

-- 3. Check buybox_offers entries (competitor data) from this job
SELECT 
    run_id,
    asin,
    sku,
    seller_id,
    seller_name,
    price,
    shipping_price,
    total_price,
    is_prime,
    is_fba,
    condition_type,
    created_at
FROM buybox_offers 
WHERE run_id = (
    SELECT id FROM buybox_jobs 
    WHERE source = 'production_test_real_api_only'
    ORDER BY started_at DESC 
    LIMIT 1
)
ORDER BY asin, total_price;

-- 4. Summary: How many records were created
SELECT 
    'buybox_data' as table_name,
    COUNT(*) as records_created
FROM buybox_data 
WHERE run_id = (
    SELECT id FROM buybox_jobs 
    WHERE source = 'production_test_real_api_only'
    ORDER BY started_at DESC 
    LIMIT 1
)
UNION ALL
SELECT 
    'buybox_offers' as table_name,
    COUNT(*) as records_created
FROM buybox_offers 
WHERE run_id = (
    SELECT id FROM buybox_jobs 
    WHERE source = 'production_test_real_api_only'
    ORDER BY started_at DESC 
    LIMIT 1
);
