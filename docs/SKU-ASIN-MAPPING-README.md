# SKU-ASIN Mapping Feature

## Overview

This feature provides comprehensive SKU-to-ASIN mapping functionality for Amazon sellers. It allows you to upload CSV files containing product information and maintains a mapping between your internal SKUs and Amazon ASINs.

## Features

✅ **CSV Upload**: Upload tab-delimited CSV files with comprehensive product information  
✅ **Bulk Import**: Process thousands of mapping records efficiently  
✅ **ASIN Tracking**: Track up to 3 ASINs per SKU (asin1, asin2, asin3)  
✅ **Search & Filter**: Search by SKU, product name, or ASIN  
✅ **Statistics**: View coverage statistics and ASIN mapping rates  
✅ **Data Management**: Clear and re-import data as needed  

## CSV Format

The system expects a **tab-delimited** CSV file with the following columns:

### Required Columns
- `seller-sku` - Your internal SKU identifier
- `item-name` - Product title/name

### Optional Columns
- `asin1` - Primary ASIN
- `asin2` - Secondary ASIN  
- `asin3` - Tertiary ASIN
- `price` - Product price
- `quantity` - Available quantity
- `fulfillment-channel` - FBA, FBM, etc.
- `merchant-shipping-group` - Shipping group
- `status` - Product status (defaults to "active")
- `item-description` - Product description
- `listing-id` - Amazon listing ID
- `open-date` - Product listing date
- `image-url` - Product image URL
- And many more...

### Example CSV Header
```
item-name	item-description	listing-id	seller-sku	price	quantity	open-date	image-url	item-is-marketplace	product-id-type	zshop-shipping-fee	item-note	item-condition	zshop-category1	zshop-browse-path	zshop-storefront-feature	asin1	asin2	asin3	will-ship-internationally	expedited-shipping	zshop-boldface	product-id	bid-for-featured-placement	add-delete	pending-quantity	fulfillment-channel	merchant-shipping-group	status	Minimum order quantity	Sell remainder
```

## API Endpoints

### Upload CSV
```http
POST /api/sku-asin-mapping/upload
Content-Type: multipart/form-data

file: [CSV file]
```

### Get Mapping Data
```http
GET /api/sku-asin-mapping?page=1&limit=50&search=SKU001&hasAsin=true
```

### Get Statistics
```http
POST /api/sku-asin-mapping
Content-Type: application/json

{
  "action": "stats"
}
```

### Clear All Data
```http
POST /api/sku-asin-mapping
Content-Type: application/json

{
  "action": "clear"
}
```

## Database Schema

The data is stored in the `sku_asin_mapping` table:

```sql
CREATE TABLE sku_asin_mapping (
  id UUID PRIMARY KEY,
  seller_sku TEXT UNIQUE NOT NULL,
  item_name TEXT,
  item_description TEXT,
  asin1 TEXT,
  asin2 TEXT,
  asin3 TEXT,
  price DECIMAL(10,2),
  quantity INTEGER,
  fulfillment_channel TEXT,
  merchant_shipping_group TEXT,
  status TEXT,
  -- ... and many more columns
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Web Interface

Access the web interface at `/sku-asin-mapping` to:

- Upload CSV files
- View mapping data with pagination
- Search and filter mappings
- View statistics and coverage metrics
- Clear data when needed

## Testing

Run the test suite to verify functionality:

```bash
node test-sku-asin-mapping.js
```

This will:
1. Create a test CSV file
2. Upload it via the API
3. Test all API endpoints
4. Verify data retrieval and filtering
5. Clean up test data

## Integration with Existing Tools

This feature integrates with your existing SP-API tools:

- **SKU-to-ASIN Lookup**: Use the mapping data to convert SKUs to ASINs
- **Pricing Dashboard**: Enhanced with ASIN mapping information
- **Buy Box Checker**: Lookup ASINs from your SKU data

## Usage Examples

### Get ASIN for a SKU
```javascript
const response = await fetch('/api/sku-asin-mapping?search=YOUR_SKU');
const data = await response.json();
const asin = data.data[0]?.asin1;
```

### Check ASIN Coverage
```javascript
const response = await fetch('/api/sku-asin-mapping', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'stats' })
});
const stats = await response.json();
console.log(`ASIN Coverage: ${stats.asinCoverage}%`);
```

### Filter by Fulfillment Channel
```javascript
const response = await fetch('/api/sku-asin-mapping?fulfillmentChannel=FBA');
const fbaProducts = await response.json();
```

## Performance

- **Bulk Import**: Processes 1000+ records per batch
- **Indexed Queries**: Fast searches on SKU, ASIN, and other fields
- **Pagination**: Efficient handling of large datasets
- **Memory Efficient**: Streaming CSV processing

## Error Handling

The system provides comprehensive error handling:

- **Validation**: Checks for required fields (seller-sku)
- **Duplicate Detection**: Handles duplicate SKUs gracefully
- **Import Tracking**: Records import success/failure details
- **Rollback**: Clear data functionality for easy resets

## Security

- **File Validation**: Only accepts CSV files
- **Size Limits**: 50MB maximum file size
- **Sanitization**: Cleans and validates input data
- **SQL Injection Protection**: Uses parameterized queries

## Maintenance

### Regular Tasks
1. **Data Refresh**: Re-import mapping data as needed
2. **Statistics Review**: Monitor ASIN coverage rates
3. **Performance Monitoring**: Watch for slow queries
4. **Storage Management**: Consider archiving old data

### Troubleshooting
1. **Upload Failures**: Check CSV format and file size
2. **Missing Data**: Verify column names and data types
3. **Performance Issues**: Review indexes and query patterns
4. **API Errors**: Check logs for detailed error messages

## Next Steps

Consider these enhancements:

1. **Auto-sync**: Scheduled imports from Amazon Seller Central
2. **Change Tracking**: History of ASIN changes over time
3. **Integration**: Direct connection to SP-API for real-time updates
4. **Validation**: ASIN existence verification
5. **Reporting**: Advanced analytics and reports
