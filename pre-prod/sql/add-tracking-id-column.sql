-- Add tracking_id and shipping details to amazon_orders table
ALTER TABLE amazon_orders 
ADD COLUMN IF NOT EXISTS tracking_id TEXT,
ADD COLUMN IF NOT EXISTS automated_carrier TEXT,
ADD COLUMN IF NOT EXISTS automated_ship_method TEXT;
