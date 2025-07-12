# Live SKU Pricing - Quick Start Guide

## 🚀 Getting Started

Your Amazon SP-API integration is now ready! Here's how to start getting live pricing for your SKUs:

### 1. Add Your SKUs

Edit the `sku-config.js` file and add your actual Amazon SKUs:

```javascript
export const YOUR_SKUS = [
    'YOUR-ACTUAL-SKU-001',
    'YOUR-ACTUAL-SKU-002',
    'YOUR-ACTUAL-SKU-003'
];
```

### 2. Run Live Pricing

```bash
# Get pricing for all configured SKUs
node live-sku-pricing.js

# Get pricing for a single SKU
node live-sku-pricing.js --sku "YOUR-SKU-123"

# Save results to CSV
node live-sku-pricing.js --csv pricing-results.csv
```

### 3. What You'll Get

For each SKU, you'll receive:
- ✅ **Current Status** (active/inactive)
- 🏷️ **ASIN** (Amazon Standard Identification Number)
- 🏆 **Buy Box Price** (current winning price)
- 💵 **Lowest Price** (cheapest available)
- 📊 **Total Offers** (number of competitors)
- 💰 **Competitor Prices** (detailed pricing data)
- 🚚 **Fulfillment Method** (FBA/FBM)

### 4. Example Output

```
📦 SKU: YOUR-SKU-123
🕐 Time: 12/20/2024, 2:30:15 PM
✅ Status: Success
🏷️ ASIN: B08XYZ12345
📊 Total Offers: 8
🏆 Buy Box: 29.99 GBP (Amazon)
💵 Lowest Price: 27.50 GBP (Merchant)
💰 Competitor Prices:
   1. 27.50 GBP (New, Merchant)
   2. 29.99 GBP (New, Amazon)
   3. 31.25 GBP (New, Merchant)
```

## 📋 Available Scripts

### Core Scripts
- `live-sku-pricing.js` - Main pricing tool
- `amazon-sp-api-diagnostics.js` - Full system diagnostics
- `test-sku-pricing.js` - Test individual SKUs

### Command Examples

```bash
# Basic usage
node live-sku-pricing.js

# Single SKU with CSV output
node live-sku-pricing.js --sku "MY-SKU-001" --csv results.csv

# Full diagnostics
node amazon-sp-api-diagnostics.js

# Test specific SKU
node test-sku-pricing.js
```

## 🔧 Configuration Options

### Marketplace Selection
Default: UK (`A1F83G8C2ARO7P`)

Available marketplaces in `sku-config.js`:
- UK: `A1F83G8C2ARO7P`
- US: `ATVPDKIKX0DER`
- DE: `A1PA6795UKMFR9`
- FR: `A13V1IB3VIYZZH`
- IT: `APJ6JRA9NG5V4`
- ES: `A1RKKUPIHCS9HS`

### Rate Limiting
- Default: 1.1 seconds between requests
- Amazon allows 1 request per second
- Adjust `RATE_LIMIT_DELAY` in config if needed

## 🎯 Production Integration

### 1. Automated Pricing Updates
Set up a cron job to run pricing updates:

```bash
# Every 30 minutes
*/30 * * * * /usr/bin/node /path/to/live-sku-pricing.js --csv /path/to/pricing-data.csv

# Every hour during business hours
0 9-17 * * * /usr/bin/node /path/to/live-sku-pricing.js --csv /path/to/pricing-data.csv
```

### 2. Database Integration
The tool returns structured data that can be easily stored:

```javascript
const result = await getCompletePricingData(sku);
// Store result in your database
await savePricingData(result);
```

### 3. Pricing Alerts
Set up alerts for significant price changes:

```javascript
if (result.buyBoxPrice.price < yourMinPrice) {
    sendAlert('Price drop detected!', result);
}
```

## 🛠️ Troubleshooting

### Common Issues

1. **"SKU not found"**
   - Verify SKU spelling matches Seller Central exactly
   - Check if product is active and published
   - Ensure product exists in the selected marketplace

2. **"Access denied"**
   - Run diagnostics: `node amazon-sp-api-diagnostics.js`
   - Check AWS IAM permissions
   - Verify API credentials in `.env`

3. **"Rate limit exceeded"**
   - Increase `RATE_LIMIT_DELAY` in config
   - Reduce batch size
   - Implement exponential backoff

### Getting Help

1. **Full Diagnostics**: `node amazon-sp-api-diagnostics.js`
2. **Check Logs**: Review console output for error details
3. **Test Single SKU**: Use `--sku` flag to test one SKU at a time
4. **Review Setup**: Check `SP-API-TROUBLESHOOTING-REPORT.md`

## 📊 CSV Output Format

When using `--csv`, you'll get a spreadsheet with:
- SKU
- Timestamp
- Success status
- ASIN
- Total offers
- Buy box price/currency/fulfillment
- Lowest price/currency/fulfillment
- Competitor count
- Error messages

## 🔄 Next Steps

1. **Add your actual SKUs** to `sku-config.js`
2. **Test with a few SKUs** first
3. **Set up automated runs** for regular updates
4. **Integrate with your pricing strategy**
5. **Monitor and adjust** based on results

## 🚨 Important Notes

- **Rate Limits**: Amazon allows 1 request per second
- **Marketplace**: Default is UK, change if needed
- **Permissions**: Uses "Pricing" and "Inventory" roles only
- **Data**: Live pricing data, updated in real-time
- **Costs**: No additional costs beyond AWS usage

Your SP-API integration is ready to go! 🎉
