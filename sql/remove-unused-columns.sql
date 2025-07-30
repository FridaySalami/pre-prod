-- Migration: Remove unused columns from buybox_data table
-- These columns either have no data or contain only static values

-- Begin transaction to ensure all changes are applied together
BEGIN;

-- Remove unused columns that have no data or only static values
-- category: Product category (no data in current dataset)
-- brand: Brand information (no data in current dataset)  
-- fulfillment_channel: Fulfillment type (no data in current dataset)
-- marketplace: Always 'UK' (static value, not needed)
-- margin_calculation_version: Always 'v1.0' (static value, not needed)
-- cost_data_source: No longer populated by cost calculator

ALTER TABLE buybox_data 
DROP COLUMN IF EXISTS category,
DROP COLUMN IF EXISTS brand,
DROP COLUMN IF EXISTS fulfillment_channel,
DROP COLUMN IF EXISTS marketplace,
DROP COLUMN IF EXISTS margin_calculation_version,
DROP COLUMN IF EXISTS cost_data_source;

-- Commit the transaction
COMMIT;

-- Verify the columns have been removed (informational query)
-- Run this separately to verify:
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'buybox_data' 
-- ORDER BY ordinal_position;
