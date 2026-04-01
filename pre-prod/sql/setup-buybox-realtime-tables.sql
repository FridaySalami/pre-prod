-- Real-time Buy Box Monitoring Tables
-- Run this in Supabase SQL Editor

-- 1. Current Buy Box Status Table (live status for each ASIN)
CREATE TABLE IF NOT EXISTS buybox_status (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(20) NOT NULL UNIQUE,
    sku VARCHAR(100),
    title TEXT,
    current_price DECIMAL(10,2),
    buy_box_winner VARCHAR(255),
    has_buy_box BOOLEAN DEFAULT FALSE,
    competitor_count INTEGER DEFAULT 0,
    lowest_price DECIMAL(10,2),
    our_price DECIMAL(10,2),
    price_difference DECIMAL(10,2),
    last_checked TIMESTAMPTZ DEFAULT NOW(),
    last_buy_box_change TIMESTAMPTZ,
    status_changed BOOLEAN DEFAULT FALSE,
    user_email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Buy Box Alerts Table (historical notifications)
CREATE TABLE IF NOT EXISTS buybox_alerts (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(20) NOT NULL,
    sku VARCHAR(100),
    alert_type VARCHAR(50) NOT NULL, -- 'buy_box_lost', 'buy_box_gained', 'price_change'
    severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    title TEXT,
    message TEXT NOT NULL,
    previous_winner VARCHAR(255),
    new_winner VARCHAR(255),
    previous_price DECIMAL(10,2),
    new_price DECIMAL(10,2),
    price_change DECIMAL(10,2),
    alert_data JSONB,
    user_email VARCHAR(255),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Monitoring Configuration (extend existing or create if not exists)
CREATE TABLE IF NOT EXISTS price_monitoring_alerts (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(20) NOT NULL,
    sku VARCHAR(100),
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium',
    message TEXT NOT NULL,
    alert_data JSONB,
    user_email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_buybox_status_asin ON buybox_status(asin);
CREATE INDEX IF NOT EXISTS idx_buybox_status_updated ON buybox_status(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_buybox_status_changed ON buybox_status(status_changed, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_buybox_alerts_asin ON buybox_alerts(asin);
CREATE INDEX IF NOT EXISTS idx_buybox_alerts_created ON buybox_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_buybox_alerts_unread ON buybox_alerts(is_read, created_at DESC);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_buybox_status_updated_at
    BEFORE UPDATE ON buybox_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update buy box status
CREATE OR REPLACE FUNCTION update_buybox_status(
    p_asin VARCHAR(20),
    p_sku VARCHAR(100),
    p_title TEXT,
    p_current_price DECIMAL(10,2),
    p_buy_box_winner VARCHAR(255),
    p_has_buy_box BOOLEAN,
    p_competitor_count INTEGER,
    p_lowest_price DECIMAL(10,2),
    p_our_price DECIMAL(10,2),
    p_user_email VARCHAR(255)
)
RETURNS VOID AS $$
DECLARE
    old_winner VARCHAR(255);
    old_price DECIMAL(10,2);
    status_changed BOOLEAN := FALSE;
BEGIN
    -- Get current values
    SELECT buy_box_winner, current_price INTO old_winner, old_price
    FROM buybox_status WHERE asin = p_asin;
    
    -- Check if status changed
    IF old_winner IS NULL OR old_winner != p_buy_box_winner OR old_price != p_current_price THEN
        status_changed := TRUE;
    END IF;
    
    -- Insert or update status
    INSERT INTO buybox_status (
        asin, sku, title, current_price, buy_box_winner, has_buy_box,
        competitor_count, lowest_price, our_price, 
        price_difference, user_email, status_changed,
        last_buy_box_change
    )
    VALUES (
        p_asin, p_sku, p_title, p_current_price, p_buy_box_winner, p_has_buy_box,
        p_competitor_count, p_lowest_price, p_our_price,
        p_current_price - p_our_price, p_user_email, status_changed,
        CASE WHEN status_changed THEN NOW() ELSE NULL END
    )
    ON CONFLICT (asin) DO UPDATE SET
        sku = EXCLUDED.sku,
        title = EXCLUDED.title,
        current_price = EXCLUDED.current_price,
        buy_box_winner = EXCLUDED.buy_box_winner,
        has_buy_box = EXCLUDED.has_buy_box,
        competitor_count = EXCLUDED.competitor_count,
        lowest_price = EXCLUDED.lowest_price,
        our_price = EXCLUDED.our_price,
        price_difference = EXCLUDED.price_difference,
        user_email = EXCLUDED.user_email,
        status_changed = status_changed,
        last_buy_box_change = CASE WHEN status_changed THEN NOW() ELSE buybox_status.last_buy_box_change END,
        last_checked = NOW();
END;
$$ LANGUAGE plpgsql;

-- Create view for dashboard
CREATE OR REPLACE VIEW buybox_dashboard AS
SELECT 
    bs.*,
    CASE 
        WHEN bs.has_buy_box THEN 'success'
        WHEN bs.buy_box_winner IS NOT NULL THEN 'warning' 
        ELSE 'danger'
    END as status_color,
    COUNT(ba.id) as alert_count,
    MAX(ba.created_at) as last_alert
FROM buybox_status bs
LEFT JOIN buybox_alerts ba ON bs.asin = ba.asin AND ba.created_at > NOW() - INTERVAL '24 hours'
GROUP BY bs.id
ORDER BY bs.status_changed DESC, bs.updated_at DESC;