-- Master SQL script to create all Buy Box monitoring tables
-- This script will create all necessary tables for the Buy Box monitoring system

-- Start a transaction to ensure all tables are created successfully
BEGIN;

-- Create buybox_jobs table first (as it's referenced by the others)
\i 'buybox-jobs-table.sql'

-- Create buybox_data table
\i 'buybox-data-table.sql'

-- Create buybox_failures table
\i 'buybox-failures-table.sql'

-- Update existing sku_asin_mapping table with needed fields
\i 'update-sku-mapping-table.sql'

-- Add any initial data or settings if needed
-- Example: INSERT INTO some_settings_table (key, value) VALUES ('buybox_scan_interval_hours', '24');

-- Commit the transaction
COMMIT;

-- Output success message
\echo 'Buy Box monitoring tables have been successfully created.'
