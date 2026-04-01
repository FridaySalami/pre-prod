-- Add missing columns for Amazon Shipping integration
-- These are required for the "Download & Sync" tool in /dashboard/tools/upload-shipping

ALTER TABLE amazon_orders 
ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS shipping_source TEXT,
ADD COLUMN IF NOT EXISTS shipping_imported_at TIMESTAMPTZ;

-- Refresh the schema cache is usually automatic, but if you still see PGRST204,
-- go to Supabase Dashboard -> API -> Docs to trigger a refresh
-- OR run: NOTIFY pgrst, 'reload config';
