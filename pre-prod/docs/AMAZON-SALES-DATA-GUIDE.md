# Amazon SP-API Sales Data Integration Guide

## Overview

Your Amazon SP-API integration now includes sales data retrieval capabilities! You can get detailed sales reports for any SKU or ASIN in your inventory.

## ✅ What Sales Data You Can Get

- **📦 Total units sold** for specific SKU/ASIN
- **💰 Total revenue generated** 
- **📋 Number of orders** containing the item
- **📊 Average order value**
- **📅 Date range analysis** (7 days, 30 days, custom)
- **🔍 Individual order details** (dates, quantities, prices, customer info)

## 🚀 Quick Usage Examples

### 1. Basic Sales Report
```javascript
const { AmazonSPAPI } = require('./render-service/services/amazon-spapi');
const amazonAPI = new AmazonSPAPI(supabaseClient);

// Get sales for last 30 days
const salesData = await amazonAPI.getSalesDataBySkuOrAsin(
  'YOUR_SKU',           // Your SKU or ASIN
  '2024-06-01',         // Start date
  '2024-06-30',         // End date  
  50                    // Max orders to check
);

console.log(`Units sold: ${salesData.total_quantity_sold}`);
console.log(`Revenue: £${salesData.total_revenue}`);
```

### 2. Command Line Usage
```bash
# Test with your actual SKU
node test-sales-data.cjs YOUR_SKU --days 30

# Test with specific date range
node test-sales-data.cjs YOUR_SKU --start 2024-06-01 --end 2024-06-30

# Test with ASIN
node test-sales-data.cjs B0104R0FRG --days 7
```

### 3. Enhanced Buy Box Analysis with Sales
```javascript
// Combine pricing + sales data
async function getFullProductAnalysis(asin, sku) {
  const amazonAPI = new AmazonSPAPI(supabaseClient);
  
  // Get current pricing
  const buyBoxData = await amazonAPI.getBuyBoxData(asin, sku, 'run-123');
  
  // Get sales performance  
  const salesData = await amazonAPI.getSalesDataBySkuOrAsin(sku, getDateDaysAgo(30));
  
  return {
    ...buyBoxData,
    sales_velocity: salesData.total_quantity_sold / 30,  // Daily average
    revenue_30_days: salesData.total_revenue,
    demand_score: calculateDemandScore(salesData)
  };
}
```

## 📊 Sample Output

```json
{
  "sku_or_asin": "YOUR_SKU",
  "date_range": {
    "start": "2024-06-01", 
    "end": "2024-06-30"
  },
  "total_quantity_sold": 45,
  "total_revenue": 1247.65,
  "total_orders": 23,
  "average_order_value": 54.25,
  "orders": [
    {
      "order_id": "202-1234567-8901234",
      "order_date": "2024-06-15T10:30:00Z",
      "sku": "YOUR_SKU",
      "asin": "B01EXAMPLE", 
      "product_name": "Your Product Name",
      "quantity": 2,
      "unit_price": 27.99,
      "total_price": 55.98,
      "currency": "GBP"
    }
  ],
  "summary": "Found 45 units sold across 23 orders, total revenue: £1247.65"
}
```

## ⚠️ Important Rate Limiting Notes

### API Limits
- **Orders API**: 0.5 requests/second (120 requests/5 minutes)
- **Order Items API**: 0.5 requests/second per order

### Best Practices for Production

1. **Limit order checks** to avoid rate limits:
   ```javascript
   // Instead of checking 100+ orders
   const salesData = await amazonAPI.getSalesDataBySkuOrAsin(sku, startDate, endDate, 20);
   ```

2. **Add delays between requests**:
   ```javascript
   // Already built into the getSalesDataBySkuOrAsin method
   await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
   ```

3. **Cache results** to avoid repeated API calls:
   ```javascript
   // Store results in database/cache
   await supabase.from('sales_cache').insert({
     sku: sku,
     date: new Date().toISOString().split('T')[0],
     sales_data: salesData
   });
   ```

## 🔧 Integration Options

### Option 1: Standalone Sales Reports
Use `getSalesDataBySkuOrAsin()` independently for sales analysis.

### Option 2: Enhanced Buy Box Analysis  
Combine with your existing buy box monitoring for complete product intelligence.

### Option 3: Scheduled Reports
Set up daily/weekly sales reports using cron jobs or scheduled functions.

## 🛠️ Troubleshooting

### Common Issues

1. **Rate Limiting (QuotaExceeded)**
   - **Cause**: Too many API requests
   - **Solution**: Reduce `maxOrders` parameter, add delays
   ```javascript
   // Reduce from 100 to 20 orders
   const salesData = await amazonAPI.getSalesDataBySkuOrAsin(sku, startDate, endDate, 20);
   ```

2. **No Sales Data Found**
   - **Cause**: SKU/ASIN not in recent orders, or no sales in date range
   - **Solution**: Check different date ranges, verify SKU/ASIN accuracy

3. **Access Denied**
   - **Cause**: Missing "Orders" permission in SP-API application
   - **Solution**: Check Amazon Developer Console > SP-API permissions

## 📈 Use Cases

### 1. **Sales Velocity Analysis**
Track how fast products are selling to optimize inventory.

### 2. **Revenue Attribution**  
See which SKUs generate the most revenue over time.

### 3. **Demand Forecasting**
Use historical sales data to predict future demand.

### 4. **Buy Box Strategy**
Combine sales velocity with pricing data to optimize buy box winning strategy.

### 5. **Product Performance**
Identify top-performing vs slow-moving inventory.

## 🎯 Next Steps

1. **Test with your actual SKUs**:
   ```bash
   node test-sales-data.cjs YOUR_ACTUAL_SKU --days 30
   ```

2. **Integrate into your buy box workflow**:
   - Add sales velocity to buy box decisions
   - Factor in demand when setting prices

3. **Set up automated reports**:
   - Daily sales summaries
   - Weekly performance reviews
   - Monthly trend analysis

## 💡 Pro Tips

- **Start with small date ranges** (7-14 days) to avoid rate limits
- **Focus on your top SKUs** first to get the most value
- **Combine with your pricing data** for complete product intelligence
- **Cache results** to minimize API calls and improve performance

---

**Ready to get sales data for your products!** 🚀

Try: `node test-sales-data.cjs YOUR_SKU --days 30`
