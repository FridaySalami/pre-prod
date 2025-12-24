CREATE TABLE IF NOT EXISTS amazon_orders (
    amazon_order_id TEXT PRIMARY KEY,
    seller_order_id TEXT,
    purchase_date TIMESTAMP WITH TIME ZONE,
    last_update_date TIMESTAMP WITH TIME ZONE,
    order_status TEXT,
    fulfillment_channel TEXT,
    sales_channel TEXT,
    order_total NUMERIC,
    currency_code TEXT,
    number_of_items_shipped INTEGER,
    number_of_items_unshipped INTEGER,
    payment_method TEXT,
    order_type TEXT,
    marketplace_id TEXT,
    buyer_email TEXT,
    buyer_name TEXT,
    shipment_service_level_category TEXT,
    earliest_ship_date TIMESTAMP WITH TIME ZONE,
    latest_ship_date TIMESTAMP WITH TIME ZONE,
    earliest_delivery_date TIMESTAMP WITH TIME ZONE,
    latest_delivery_date TIMESTAMP WITH TIME ZONE,
    is_business_order BOOLEAN,
    is_prime BOOLEAN,
    is_premium_order BOOLEAN,
    is_global_express_enabled BOOLEAN,
    is_replacement_order BOOLEAN,
    is_sold_by_ab BOOLEAN,
    raw_data JSONB, -- Store the full raw JSON response just in case
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_amazon_orders_purchase_date ON amazon_orders(purchase_date);
