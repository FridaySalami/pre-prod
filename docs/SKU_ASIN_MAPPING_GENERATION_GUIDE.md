# SKU-ASIN Mapping Table - Generation & Update Guide

## Overview

The `sku_asin_mapping` table is the primary source of product information in your system. It stores the relationship between your seller SKUs and Amazon ASINs, along with product names and other details.

## How the Table is Populated

### Primary Method: Manual CSV Upload

The main way to populate the `sku_asin_mapping` table is by **uploading CSV files through the web interface**.

#### 1. Access the Upload Interface

Navigate to: **`/sku-asin-mapping`**

This page provides:
- CSV file upload functionality
- View existing mappings
- Search and filter capabilities
- Statistics dashboard

#### 2. CSV File Format

The system expects a **tab-delimited or comma-delimited** CSV file with these columns:

**Required Columns:**
- `seller-sku` - Your internal SKU identifier
- `item-name` - Product title/name

**Optional Columns (commonly used):**
- `asin1` - Primary ASIN
- `asin2` - Secondary ASIN
- `asin3` - Tertiary ASIN
- `price` - Product price
- `quantity` - Available quantity
- `fulfillment-channel` - FBA, FBM, etc.
- `merchant-shipping-group` - Shipping group
- `status` - Product status

**Example CSV:**
```csv
seller-sku,item-name,asin1,price,quantity,fulfillment-channel,status
SKU001,Callebaut Chocolate Dark 70.5%,B00C1U8S9G,45.99,100,FBA,active
SKU002,Rowse Runny Honey 3.17kg,B00FXQABCD,22.50,50,FBM,active
```

#### 3. Upload Process

1. Click the **"Upload CSV"** button on `/sku-asin-mapping`
2. Select your CSV file (max 50MB)
3. The system will:
   - Validate file format
   - Parse the CSV (handles quoted values)
   - Insert/update records in batches of 1000
   - Handle duplicates via upsert on `seller_sku`
   - Log the import in `sku_asin_mapping_imports` table

## Backend Components

### Service Layer: `skuAsinImportService.ts`

**Location:** `/src/lib/services/skuAsinImportService.ts`

**Key Functions:**

```typescript
// Main import function
async importMappings(filePath: string): Promise<{
  success: boolean;
  imported: number;
  errors: string[];
  duration: number;
  filename?: string;
}>

// Parses CSV and handles various column name formats
private async parseCSV(filePath: string): Promise<SkuAsinMappingData[]>

// Flexible column matching (handles dashes, underscores, variations)
private findColumnIndex(headers: string[], possibleNames: string[])
```

**Features:**
- ✅ Batch processing (1000 records per batch)
- ✅ Flexible column name matching
- ✅ Handles quoted CSV values
- ✅ Upsert logic (updates existing SKUs)
- ✅ Progress logging
- ✅ Error tracking per batch

### API Endpoint: `upload/+server.ts`

**Location:** `/src/routes/api/sku-asin-mapping/upload/+server.ts`

**Endpoint:** `POST /api/sku-asin-mapping/upload`

**Process:**
1. Receives multipart form data with CSV file
2. Validates file type (.csv only) and size (<50MB)
3. Saves to temporary file
4. Calls `skuAsinImportService.importMappings()`
5. Cleans up temp file
6. Returns import results

**Response Format:**
```json
{
  "success": true,
  "message": "File uploaded successfully. Imported 1200 records with 0 errors.",
  "filename": "sku_asin_mapping_1729008765432_products.csv",
  "imported": 1200,
  "errors": []
}
```

## Database Schema

### Main Table: `sku_asin_mapping`

```sql
CREATE TABLE IF NOT EXISTS sku_asin_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_sku TEXT UNIQUE NOT NULL,        -- Primary key for lookups
  item_name TEXT,                          -- Product title
  asin1 TEXT,                              -- Primary ASIN
  asin2 TEXT,                              -- Secondary ASIN
  asin3 TEXT,                              -- Tertiary ASIN
  price DECIMAL(10,2),
  quantity INTEGER,
  fulfillment_channel TEXT,
  merchant_shipping_group TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast ASIN lookups
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_asin1 ON sku_asin_mapping(asin1);
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_seller_sku ON sku_asin_mapping(seller_sku);
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_item_name ON sku_asin_mapping USING gin(to_tsvector('english', item_name));
```

### Import Tracking Table: `sku_asin_mapping_imports`

```sql
CREATE TABLE IF NOT EXISTS sku_asin_mapping_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename TEXT NOT NULL,
  records_count INTEGER DEFAULT 0,
  status TEXT,                             -- processing, completed, failed
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Current Usage in Your System

### 1. Sales Dashboard

**File:** `/src/routes/sales-dashboard/+page.server.ts`

**Usage:** Joins `amazon_sales_data` with `sku_asin_mapping` to display product titles:

```typescript
// Fetch product titles from sku_asin_mapping
const { data: titleData } = await supabase
  .from('sku_asin_mapping')
  .select('asin1, item_name')
  .in('asin1', asins);

// Build map for quick lookup
const productTitles = new Map<string, string>();
titleData?.forEach(row => {
  if (row.asin1 && row.item_name) {
    productTitles.set(row.asin1, row.item_name);
  }
});
```

### 2. Buy Box Manager

**File:** `/restart-buybox-job.mjs`

**Usage:** Fetches ASINs and product info for Buy Box monitoring:

```javascript
const { data: products } = await supabase
  .from('sku_asin_mapping')
  .select('asin1, item_name, seller_sku')
  .not('asin1', 'is', null);
```

### 3. Product Lookup API

**File:** `/src/routes/api/match-buybox/+server.ts`

**Usage:** Looks up product details by ASIN:

```typescript
const { data: productInfo } = await supabase
  .from('sku_asin_mapping')
  .select('item_name, seller_sku, price, status')
  .eq('asin1', asin)
  .single();
```

## How to Update the Table

### Method 1: Re-upload CSV (Recommended)

1. Export latest product data from Amazon Seller Central
2. Go to `/sku-asin-mapping`
3. Click **"Upload CSV"**
4. Select your updated file
5. The system will **upsert** records:
   - Existing SKUs are **updated** with new data
   - New SKUs are **inserted**
   - Old SKUs not in the CSV remain unchanged

### Method 2: API Upload

```bash
curl -X POST http://localhost:3000/api/sku-asin-mapping/upload \
  -F "file=@products.csv"
```

### Method 3: Direct Database Update

For bulk updates via SQL:

```sql
-- Update specific product
UPDATE sku_asin_mapping
SET item_name = 'New Product Name',
    price = 49.99,
    updated_at = NOW()
WHERE seller_sku = 'SKU001';

-- Bulk update from another table
UPDATE sku_asin_mapping sm
SET price = new_prices.price
FROM new_prices_import new_prices
WHERE sm.seller_sku = new_prices.sku;
```

### Method 4: Programmatic Insert/Update

Using the Supabase client:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);

// Insert or update
const { data, error } = await supabase
  .from('sku_asin_mapping')
  .upsert({
    seller_sku: 'SKU123',
    item_name: 'New Product',
    asin1: 'B00EXAMPLE',
    price: 29.99,
    status: 'active'
  }, {
    onConflict: 'seller_sku'
  });
```

## Where to Get CSV Data

### Amazon Seller Central

1. **Active Listings Report**
   - Go to: Inventory → Inventory Reports → Active Listings Report
   - Contains: SKU, ASIN, Title, Price, Quantity, Status
   - Download as tab-delimited text file

2. **All Listings Report**
   - Go to: Inventory → Inventory Reports → All Listings Report
   - More comprehensive than Active Listings
   - Includes inactive products

3. **Open Listings Report**
   - Includes listing-id, open-date, fulfillment channel
   - Good for full product catalog exports

### Format Conversion

If you get a tab-delimited `.txt` file:

```bash
# Save as .csv extension
mv Active_Listings_Report.txt products.csv

# Or convert tabs to commas (optional)
sed 's/\t/,/g' Active_Listings_Report.txt > products.csv
```

## Testing the Import

Use the test script to verify functionality:

```bash
node test-sku-asin-mapping.js
```

This creates sample data and tests:
- ✅ CSV upload
- ✅ Data retrieval
- ✅ Search functionality
- ✅ Statistics calculation
- ✅ Error handling

## Best Practices

### 1. Regular Updates
- **Weekly:** Upload fresh product data from Seller Central
- Keeps prices, quantities, and titles current

### 2. Column Consistency
- Use standard Amazon column names (item-name, seller-sku, asin1)
- The parser is flexible but consistent naming helps

### 3. File Size
- For files >50MB, split into smaller batches
- Process 10,000-20,000 rows per file for optimal performance

### 4. Data Quality
- Ensure `seller-sku` is unique
- Include `item-name` for all products (used extensively in dashboards)
- Add `asin1` whenever available (critical for sales data joins)

### 5. Backup Before Updates
```sql
-- Create backup table
CREATE TABLE sku_asin_mapping_backup_20251015 AS
SELECT * FROM sku_asin_mapping;

-- Verify count
SELECT COUNT(*) FROM sku_asin_mapping_backup_20251015;
```

### 6. Monitor Import Logs

Check the import history:

```sql
SELECT 
  filename,
  records_count,
  status,
  notes,
  created_at
FROM sku_asin_mapping_imports
ORDER BY created_at DESC
LIMIT 10;
```

## Troubleshooting

### Issue: Product titles not showing in Sales Dashboard

**Cause:** Missing join between `amazon_sales_data.asin` and `sku_asin_mapping.asin1`

**Solution:**
1. Verify ASINs exist in mapping table:
```sql
SELECT COUNT(*) FROM sku_asin_mapping WHERE asin1 IS NOT NULL;
```

2. Check for ASIN mismatches:
```sql
SELECT DISTINCT asd.asin
FROM amazon_sales_data asd
LEFT JOIN sku_asin_mapping sam ON asd.asin = sam.asin1
WHERE sam.asin1 IS NULL
LIMIT 20;
```

3. Upload missing products via CSV

### Issue: Upload fails with "No file uploaded"

**Cause:** Form data not properly formatted

**Solution:**
```javascript
// Correct form data format
const formData = new FormData();
formData.append('file', fileInput.files[0]);

await fetch('/api/sku-asin-mapping/upload', {
  method: 'POST',
  body: formData  // Don't set Content-Type header
});
```

### Issue: Duplicate SKU errors

**Cause:** CSV contains duplicate seller-sku values

**Solution:**
1. Pre-process CSV to remove duplicates:
```bash
# Keep first occurrence of each SKU
awk -F',' '!seen[$1]++' products.csv > products_deduped.csv
```

2. Or use UPSERT which will update duplicates

## Summary

**Generation:** Manual CSV upload via `/sku-asin-mapping` page  
**Update:** Re-upload CSV files (upserts existing records)  
**Source:** Amazon Seller Central Active/All Listings Reports  
**Critical Fields:** `seller_sku`, `item_name`, `asin1`  
**Used By:** Sales Dashboard, Buy Box Manager, Product Lookup APIs  
**Batch Size:** 1000 records per batch  
**File Limit:** 50MB max  

The system is designed for **self-service management** - you control when and how to update product data by uploading fresh CSV exports from Amazon.
