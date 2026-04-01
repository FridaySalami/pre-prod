ALTER TABLE amazon_orders
ADD COLUMN IF NOT EXISTS automated_carrier TEXT,
ADD COLUMN IF NOT EXISTS automated_ship_method TEXT;
