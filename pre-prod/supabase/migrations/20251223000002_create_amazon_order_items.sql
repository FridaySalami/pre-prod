CREATE TABLE IF NOT EXISTS amazon_order_items (
    amazon_order_item_id TEXT PRIMARY KEY,
    amazon_order_id TEXT REFERENCES amazon_orders(amazon_order_id),
    asin TEXT,
    seller_sku TEXT,
    title TEXT,
    quantity_ordered INTEGER,
    quantity_shipped INTEGER,
    item_price_amount NUMERIC,
    item_price_currency TEXT,
    item_tax_amount NUMERIC,
    item_tax_currency TEXT,
    promotion_discount_amount NUMERIC,
    promotion_discount_currency TEXT,
    is_gift BOOLEAN,
    condition_id TEXT,
    condition_subtype_id TEXT,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_amazon_order_items_order_id ON amazon_order_items(amazon_order_id);
CREATE INDEX IF NOT EXISTS idx_amazon_order_items_asin ON amazon_order_items(asin);
CREATE INDEX IF NOT EXISTS idx_amazon_order_items_sku ON amazon_order_items(seller_sku);
