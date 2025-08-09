-- Clear BuyBox Data Tables Script
-- This script will completely clear all data from buybox_data and buybox_offers tables
-- Run this to start fresh with clean tables

-- Show current row counts before clearing
SELECT 'buybox_data' as table_name, COUNT(*) as row_count FROM buybox_data
UNION ALL
SELECT 'buybox_offers' as table_name, COUNT(*) as row_count FROM buybox_offers
UNION ALL
SELECT 'buybox_jobs' as table_name, COUNT(*) as row_count FROM buybox_jobs;

-- Clear buybox_offers table first (child table with foreign key to buybox_data)
DELETE FROM buybox_offers;

-- Clear buybox_data table
DELETE FROM buybox_data;

-- Clear buybox_jobs table (if you want to clear job history too)
-- Uncomment the next line if you want to clear job records as well
-- DELETE FROM buybox_jobs;

-- Show row counts after clearing to confirm
SELECT 'buybox_data' as table_name, COUNT(*) as row_count FROM buybox_data
UNION ALL
SELECT 'buybox_offers' as table_name, COUNT(*) as row_count FROM buybox_offers
UNION ALL
SELECT 'buybox_jobs' as table_name, COUNT(*) as row_count FROM buybox_jobs;

-- Optional: Reset sequences if they exist (uncomment if needed)
-- ALTER SEQUENCE buybox_data_id_seq RESTART WITH 1;
-- ALTER SEQUENCE buybox_offers_id_seq RESTART WITH 1;
-- ALTER SEQUENCE buybox_jobs_id_seq RESTART WITH 1;
