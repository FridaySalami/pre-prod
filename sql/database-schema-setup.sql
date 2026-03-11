-- Match Buy Box Database Schema Setup
-- Safe execution with IF NOT EXISTS checks

-- 1. Add product_type column to buybox_data table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'buybox_data' 
        AND column_name = 'product_type'
    ) THEN
        ALTER TABLE buybox_data ADD COLUMN product_type TEXT;
        RAISE NOTICE 'Added product_type column to buybox_data table';
    ELSE
        RAISE NOTICE 'product_type column already exists in buybox_data table';
    END IF;
END $$;

-- 2. Create index for product_type column (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'buybox_data' 
        AND indexname = 'idx_buybox_data_product_type'
    ) THEN
        CREATE INDEX idx_buybox_data_product_type ON buybox_data(product_type);
        RAISE NOTICE 'Created index idx_buybox_data_product_type';
    ELSE
        RAISE NOTICE 'Index idx_buybox_data_product_type already exists';
    END IF;
END $$;

-- 3. Create sku_product_types table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'sku_product_types'
    ) THEN
        CREATE TABLE sku_product_types (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sku TEXT UNIQUE NOT NULL,
            asin TEXT,
            product_type TEXT NOT NULL,
            verified_at TIMESTAMP DEFAULT NOW(),
            source TEXT DEFAULT 'amazon_api',
            marketplace_id TEXT DEFAULT 'A1F83G8C2ARO7P'
        );
        RAISE NOTICE 'Created sku_product_types table';
    ELSE
        RAISE NOTICE 'sku_product_types table already exists';
    END IF;
END $$;

-- 4. Create indexes for sku_product_types table (if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'sku_product_types' 
        AND indexname = 'idx_sku_product_types_sku'
    ) THEN
        CREATE INDEX idx_sku_product_types_sku ON sku_product_types(sku);
        RAISE NOTICE 'Created index idx_sku_product_types_sku';
    ELSE
        RAISE NOTICE 'Index idx_sku_product_types_sku already exists';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'sku_product_types' 
        AND indexname = 'idx_sku_product_types_asin'
    ) THEN
        CREATE INDEX idx_sku_product_types_asin ON sku_product_types(asin);
        RAISE NOTICE 'Created index idx_sku_product_types_asin';
    ELSE
        RAISE NOTICE 'Index idx_sku_product_types_asin already exists';
    END IF;
END $$;

-- 5. Create price_history table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'price_history'
    ) THEN
        CREATE TABLE price_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            record_id UUID REFERENCES buybox_data(id),
            sku TEXT NOT NULL,
            asin TEXT,
            old_price NUMERIC(10,2),
            new_price NUMERIC(10,2),
            change_reason TEXT DEFAULT 'match_buy_box',
            product_type TEXT,
            feed_id TEXT,
            updated_by UUID REFERENCES auth.users(id),
            success BOOLEAN DEFAULT false,
            error_message TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
        RAISE NOTICE 'Created price_history table';
    ELSE
        RAISE NOTICE 'price_history table already exists';
    END IF;
END $$;

-- 6. Create indexes for price_history table (if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'price_history' 
        AND indexname = 'idx_price_history_sku'
    ) THEN
        CREATE INDEX idx_price_history_sku ON price_history(sku);
        RAISE NOTICE 'Created index idx_price_history_sku';
    ELSE
        RAISE NOTICE 'Index idx_price_history_sku already exists';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'price_history' 
        AND indexname = 'idx_price_history_date'
    ) THEN
        CREATE INDEX idx_price_history_date ON price_history(created_at);
        RAISE NOTICE 'Created index idx_price_history_date';
    ELSE
        RAISE NOTICE 'Index idx_price_history_date already exists';
    END IF;
END $$;

-- 7. Verify the schema setup
SELECT 
    'buybox_data' as table_name,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'buybox_data' AND column_name = 'product_type') as has_product_type_column
UNION ALL
SELECT 
    'sku_product_types' as table_name,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'sku_product_types') as table_exists
UNION ALL
SELECT 
    'price_history' as table_name,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'price_history') as table_exists;

-- Final confirmation message
DO $$ 
BEGIN
    RAISE NOTICE '✅ Database schema setup complete! All tables and indexes are ready for Match Buy Box functionality.';
END $$;
