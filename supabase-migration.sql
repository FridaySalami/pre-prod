-- Supabase Migration Script for Pricer Application
-- This script creates all necessary tables for the pricer system
-- Run this in your Supabase SQL Editor

-- Enable RLS (Row Level Security) if needed
-- Note: For admin tools like this, you might want to disable RLS or create appropriate policies

-- Amazon Listings Table
CREATE TABLE IF NOT EXISTS amazon_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_sku TEXT UNIQUE NOT NULL,
  item_name TEXT NOT NULL,
  price DECIMAL(10,2),
  merchant_shipping_group TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_amazon_listings_seller_sku ON amazon_listings(seller_sku);
CREATE INDEX IF NOT EXISTS idx_amazon_listings_status ON amazon_listings(status);
CREATE INDEX IF NOT EXISTS idx_amazon_listings_shipping_group ON amazon_listings(merchant_shipping_group);
CREATE INDEX IF NOT EXISTS idx_amazon_listings_price ON amazon_listings(price);
CREATE INDEX IF NOT EXISTS idx_amazon_listings_created_at ON amazon_listings(created_at);

-- Inventory Table
CREATE TABLE IF NOT EXISTS inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  stock_level INTEGER,
  depth DECIMAL(8,2),
  height DECIMAL(8,2),
  width DECIMAL(8,2),
  purchase_price DECIMAL(10,2),
  retail_price DECIMAL(10,2),
  title TEXT NOT NULL,
  tracked BOOLEAN DEFAULT true,
  weight DECIMAL(8,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for inventory
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_title ON inventory(title);
CREATE INDEX IF NOT EXISTS idx_inventory_tracked ON inventory(tracked);
CREATE INDEX IF NOT EXISTS idx_inventory_purchase_price ON inventory(purchase_price);
CREATE INDEX IF NOT EXISTS idx_inventory_retail_price ON inventory(retail_price);
CREATE INDEX IF NOT EXISTS idx_inventory_created_at ON inventory(created_at);

-- Sage Reports Table
CREATE TABLE IF NOT EXISTS sage_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_code TEXT UNIQUE NOT NULL,
  bin_name TEXT,
  standard_cost DECIMAL(10,2),
  tax_rate DECIMAL(5,2),
  price DECIMAL(10,2),
  product_group_code TEXT,
  bom_item_type_id TEXT,
  company_name TEXT,
  supplier_account_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for sage reports
CREATE INDEX IF NOT EXISTS idx_sage_reports_stock_code ON sage_reports(stock_code);
CREATE INDEX IF NOT EXISTS idx_sage_reports_company_name ON sage_reports(company_name);
CREATE INDEX IF NOT EXISTS idx_sage_reports_supplier ON sage_reports(supplier_account_number);
CREATE INDEX IF NOT EXISTS idx_sage_reports_price ON sage_reports(price);
CREATE INDEX IF NOT EXISTS idx_sage_reports_created_at ON sage_reports(created_at);

-- Linnworks Composition Table
CREATE TABLE IF NOT EXISTS linnworks_composition (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_sku TEXT NOT NULL,
  parent_title TEXT,
  child_sku TEXT NOT NULL,
  child_title TEXT,
  quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_sku, child_sku)
);

-- Create indexes for linnworks composition
CREATE INDEX IF NOT EXISTS idx_linnworks_comp_parent_sku ON linnworks_composition(parent_sku);
CREATE INDEX IF NOT EXISTS idx_linnworks_comp_child_sku ON linnworks_composition(child_sku);
CREATE INDEX IF NOT EXISTS idx_linnworks_comp_created_at ON linnworks_composition(created_at);

-- Linnworks Composition Summary Table
CREATE TABLE IF NOT EXISTS linnworks_composition_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_sku TEXT NOT NULL,
  parent_title TEXT,
  child_skus TEXT, -- JSON or comma-separated
  child_titles TEXT, -- JSON or comma-separated
  child_quantities TEXT, -- JSON or comma-separated
  child_prices TEXT, -- JSON or comma-separated
  child_vats TEXT, -- JSON or comma-separated
  total_qty INTEGER,
  total_value DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for summary table
CREATE INDEX IF NOT EXISTS idx_linnworks_summary_parent_sku ON linnworks_composition_summary(parent_sku);

-- Import Records Table (for tracking uploads)
CREATE TABLE IF NOT EXISTS import_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'amazon_listings', 'inventory', 'sage_reports', 'linnworks_composition'
  status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
  records_total INTEGER,
  records_processed INTEGER,
  records_failed INTEGER,
  errors TEXT, -- JSON string for error details
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for import records
CREATE INDEX IF NOT EXISTS idx_import_records_file_type ON import_records(file_type);
CREATE INDEX IF NOT EXISTS idx_import_records_status ON import_records(status);
CREATE INDEX IF NOT EXISTS idx_import_records_imported_at ON import_records(imported_at);

-- Audit Log Table (optional, for tracking changes)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  changes TEXT, -- JSON string
  user_id TEXT,
  user_email TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);

-- Update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to all tables
CREATE TRIGGER update_amazon_listings_updated_at BEFORE UPDATE ON amazon_listings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sage_reports_updated_at BEFORE UPDATE ON sage_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_linnworks_composition_updated_at BEFORE UPDATE ON linnworks_composition FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_linnworks_composition_summary_updated_at BEFORE UPDATE ON linnworks_composition_summary FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create RLS policies (optional - uncomment if you want to enable RLS)
-- ALTER TABLE amazon_listings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sage_reports ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE linnworks_composition ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE import_records ENABLE ROW LEVEL SECURITY;

-- Sample RLS policies (adjust based on your auth requirements)
-- CREATE POLICY "Enable all access for authenticated users" ON amazon_listings FOR ALL USING (auth.role() = 'authenticated');
-- CREATE POLICY "Enable all access for authenticated users" ON inventory FOR ALL USING (auth.role() = 'authenticated');
-- CREATE POLICY "Enable all access for authenticated users" ON sage_reports FOR ALL USING (auth.role() = 'authenticated');
-- CREATE POLICY "Enable all access for authenticated users" ON linnworks_composition FOR ALL USING (auth.role() = 'authenticated');
-- CREATE POLICY "Enable all access for authenticated users" ON import_records FOR ALL USING (auth.role() = 'authenticated');

-- Grant permissions to authenticated users (if needed)
-- GRANT ALL ON amazon_listings TO authenticated;
-- GRANT ALL ON inventory TO authenticated;
-- GRANT ALL ON sage_reports TO authenticated;
-- GRANT ALL ON linnworks_composition TO authenticated;
-- GRANT ALL ON import_records TO authenticated;
-- GRANT ALL ON audit_log TO authenticated;

COMMENT ON TABLE amazon_listings IS 'Amazon seller listings data imported from CSV files';
COMMENT ON TABLE inventory IS 'Inventory items data with stock levels, dimensions, and pricing';
COMMENT ON TABLE sage_reports IS 'Sage accounting system reports with cost and supplier data';
COMMENT ON TABLE linnworks_composition IS 'Linnworks product composition and BOM data';
COMMENT ON TABLE import_records IS 'Tracking table for CSV file imports and their status';
COMMENT ON TABLE audit_log IS 'Audit trail for data changes and user actions';
