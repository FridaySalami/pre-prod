# Database Cleanup Summary

## Overview
Cleaned up unused columns from the `buybox_data` table and removed corresponding code that was populating these fields with unused or static data.

## Removed Columns

### 1. **category** 
- **Reason**: No data in current dataset
- **Original Purpose**: Store product category metadata from Amazon
- **Current State**: Always null/empty

### 2. **brand**
- **Reason**: No data in current dataset  
- **Original Purpose**: Store brand information from Amazon metadata
- **Current State**: Always null/empty

### 3. **fulfillment_channel**
- **Reason**: No data in current dataset
- **Original Purpose**: Track whether fulfillment was AMAZON (FBA) or DEFAULT (FBM)
- **Current State**: Always null/empty

### 4. **marketplace**
- **Reason**: Static value, always 'UK'
- **Original Purpose**: Support multi-marketplace operations
- **Current State**: Hard-coded to 'UK' in all cases

### 5. **margin_calculation_version**
- **Reason**: Static value, always 'v1.0'
- **Original Purpose**: Track calculation methodology versions
- **Current State**: Hard-coded to 'v1.0' in all cases

### 6. **cost_data_source**
- **Reason**: No longer needed with simplified cost calculator
- **Original Purpose**: Track whether costs came from 'linnworks', 'mock', or 'fallback'
- **Current State**: Not used by frontend or analysis

## Code Changes Made

### 1. **cost-calculator.js**
- ✅ Removed `cost_data_source` from all return objects
- ✅ Removed `margin_calculation_version: 'v1.0'` from enrichBuyBoxData()
- ✅ Removed `dataSource` field from calculateProductCosts()
- ✅ Simplified error handling to not include unused metadata

### 2. **bulk-scan.js** 
- ✅ Removed `margin_calculation_version: 'v1.0'` from mock data
- ✅ Removed `cost_data_source: 'mock'` from mock data
- ✅ Cleaned up comments for unused fields

### 3. **amazon-spapi.js**
- ✅ No changes needed (fields were already commented out)

## Database Migration Required

**File**: `/Users/jackweston/Projects/pre-prod/sql/remove-unused-columns.sql`

**Action**: Run this SQL script against your Supabase database to remove the unused columns.

## Benefits

1. **Reduced Data Storage**: Smaller row size in `buybox_data` table
2. **Cleaner Code**: Removed unnecessary field assignments
3. **Better Performance**: Fewer columns to process in queries
4. **Simplified Maintenance**: No need to maintain unused fields
5. **Clearer Intent**: Code only handles data that's actually used

## Verification Steps

After running the SQL migration:

1. ✅ Server restarted successfully with cleaned code
2. ⏳ Run SQL migration to drop columns
3. ⏳ Test a buy box scan to ensure data still saves correctly
4. ⏳ Verify frontend still displays all needed information

## Next Steps

1. **Run the SQL migration** using the provided script to remove unused columns
2. **Run the SQL script** to add the new item_name column: `/Users/jackweston/Projects/pre-prod/sql/add-item-name-column.sql`
3. **Test the system** with a small buy box scan
4. **Monitor logs** for any references to removed fields
5. **Update any reports** that might reference the removed columns

## Recent Addition: item_name Column

### ✅ **Added item_name Support**
- **Purpose**: Store product names from `sku_asin_mapping.item_name`
- **Location**: New column in `buybox_data` table
- **Code Updated**: Cost calculator now fetches and includes item names
- **SQL Script**: `/Users/jackweston/Projects/pre-prod/sql/add-item-name-column.sql`

### Code Changes for item_name:
1. **cost-calculator.js** - Updated SKU mapping query to fetch `item_name`
2. **cost-calculator.js** - Added `item_name` to cost data return object
3. **cost-calculator.js** - Included `item_name` in enriched buy box data
4. **Server restarted** - Changes are active and ready to populate item names
