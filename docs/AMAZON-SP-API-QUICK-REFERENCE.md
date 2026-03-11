# Amazon SP-API Quick Reference Guide

## Overview
Your Amazon SP-API integration is fully configured and ready for production use. This guide provides quick commands and examples for common pricing operations.

## Prerequisites
- ✅ Environment variables configured in `.env`
- ✅ Node.js dependencies installed (`npm install`)
- ✅ AWS and Amazon credentials validated

## Quick Commands

### 1. Get Pricing for a Single ASIN
```bash
node test-live-asin-pricing.js B0104R0FRG
```

**Example Output:**
```
✅ SUCCESS! Found pricing data:
   📊 Total Offers: 2
   💰 Lowest Price: £22.97 GBP
   🏆 Buy Box Price: £22.97 GBP
```

### 2. Convert SKU to ASIN
```bash
node sku-to-asin-lookup.js YOUR_SKU_HERE
```

**Example Output:**
```
✅ Found ASIN: B0104R0FRG
📦 Title: Your Product Title
📊 Status: Active
```

### 3. Complete Pricing Dashboard
```bash
# For SKUs
node pricing-dashboard.js --sku YOUR_SKU

# For ASINs  
node pricing-dashboard.js --asin B0104R0FRG

# For multiple items
node pricing-dashboard.js --sku SKU1 SKU2 --asin ASIN1 ASIN2
```

### 4. Check Buy Box Ownership
```bash
node enhanced-buy-box-checker.cjs B0104R0FRG
```

**Example Output:**
```
🏆 BUY BOX ANALYSIS
Buy Box Winner Details:
💰 Price: 22.97 GBP
🆔 Seller ID: A2D8NG39VURSL3
```

### 5. Find Your Seller ID
```bash
node find-seller-id.cjs
```

### 6. System Diagnostics
```bash
node amazon-sp-api-diagnostics.js
```

## Common Use Cases

### Case 1: You have ASINs and want pricing
```bash
node test-live-asin-pricing.js B0104R0FRG
```

### Case 2: You have SKUs and want pricing
```bash
# Step 1: Get ASIN from SKU
node sku-to-asin-lookup.js YOUR_SKU

# Step 2: Use ASIN for pricing (or use the dashboard)
node pricing-dashboard.js --sku YOUR_SKU
```

### Case 4: Check if you own the Buy Box
```bash
# Step 1: Find your seller ID
node find-seller-id.cjs

# Step 2: Check Buy Box ownership
node enhanced-buy-box-checker.cjs B0104R0FRG

# Step 3: Compare the Buy Box winner's seller ID with yours
```

### Case 5: Batch processing multiple products
```bash
node pricing-dashboard.js --sku SKU1 SKU2 SKU3 --asin ASIN1 ASIN2
```

## Understanding the Output

### Pricing Data Format
```json
{
  "totalOffers": 2,
  "lowestPrice": {
    "price": 22.97,
    "currency": "GBP"
  },
  "buyBoxPrice": {
    "price": 22.97,
    "currency": "GBP"
  },
  "offers": [
    {
      "price": 22.97,
      "currency": "GBP",
      "condition": "new",
      "fulfillment": "FBM",
      "buyBox": true
    }
  ]
}
```

### Buy Box Analysis Format
```json
{
  "asin": "B0104R0FRG",
  "youHaveListing": false,
  "buyBoxWinner": {
    "sellerId": "A2D8NG39VURSL3",
    "price": 22.97,
    "currency": "GBP",
    "fulfillment": "FBM",
    "primeEligible": false,
    "isBuyBox": true
  },
  "totalOffers": 2,
  "offers": [...]
}
```

### Key Fields Explained
- **totalOffers**: Number of sellers offering the product
- **lowestPrice**: Cheapest offer available
- **buyBoxPrice**: Current Buy Box winner price
- **sellerId**: Amazon seller identifier (compare with your own)
- **fulfillment**: FBA (Fulfilled by Amazon) or FBM (Fulfilled by Merchant)
- **buyBox**: Whether this offer wins the Buy Box
- **primeEligible**: Whether offer is Prime eligible

## Buy Box Ownership

### How to Check if You Own the Buy Box
1. **Find your seller ID** using one of these methods:
   - Amazon Seller Central → Settings → Account Info
   - Check product URLs for `merchant=` parameter
   - Download any business report and check seller ID field
   - Use: `node find-seller-id.cjs` for guidance

2. **Run Buy Box analysis**:
   ```bash
   node enhanced-buy-box-checker.cjs YOUR_ASIN
   ```

3. **Compare seller IDs**:
   - Look for the Buy Box winner's seller ID in the output
   - Compare it with your seller ID
   - If they match, you own the Buy Box! 🏆

### Buy Box Winning Factors
- **Competitive pricing** (usually need to match or beat lowest price)
- **Fulfillment method** (FBA often preferred over FBM)
- **Prime eligibility** (critical for Prime customers)
- **Seller performance metrics** (ratings, feedback, account health)
- **Inventory availability** (consistent stock levels)
- **Shipping speed** (faster shipping preferred)

## Error Handling

### Common Errors and Solutions

| Error | Meaning | Solution |
|-------|---------|----------|
| 404 | No pricing data | Product may not have active offers |
| 403 | Unauthorized | Check your credentials in `.env` |
| 429 | Rate limited | Wait and retry with delays |
| 500 | Server error | Retry after a few minutes |

### Rate Limiting
- The scripts include 1-second delays between requests
- For production, implement exponential backoff
- Monitor your rate limit usage in the Developer Console

## Integration Examples

### Basic Node.js Integration
```javascript
const { getPricingData } = require('./pricing-dashboard.js');

async function getProductPrice(asin) {
  const accessToken = await getAccessToken();
  const pricingData = await getPricingData(accessToken, asin);
  return pricingData;
}
```

### Batch Processing
```javascript
async function processBatch(asins) {
  const results = [];
  for (const asin of asins) {
    const result = await processItem(accessToken, asin, 'asin');
    results.push(result);
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return results;
}
```

## Production Checklist

### Before Going Live
- [ ] Test with your actual SKUs/ASINs
- [ ] Implement proper error handling
- [ ] Set up rate limiting with exponential backoff
- [ ] Add logging for debugging
- [ ] Monitor API usage and limits
- [ ] Set up alerts for failures

### Performance Optimization
- [ ] Cache SKU-to-ASIN mappings
- [ ] Implement bulk processing for large inventories
- [ ] Use connection pooling for multiple requests
- [ ] Consider implementing a queue system for high-volume operations

## Support

If you encounter issues:
1. Run the diagnostics script first: `node amazon-sp-api-diagnostics.js`
2. Check the SP-API-TROUBLESHOOTING-REPORT.md for detailed troubleshooting
3. Verify your environment variables are correctly set
4. Ensure your Amazon Developer Console roles are still active

## API Documentation References
- [SP-API Product Pricing API](https://developer-docs.amazon.com/sp-api/docs/product-pricing-api-v0-reference)
- [SP-API Catalog Items API](https://developer-docs.amazon.com/sp-api/docs/catalog-items-api-v2022-04-01-reference)
- [SP-API Rate Limits](https://developer-docs.amazon.com/sp-api/docs/usage-plans-and-rate-limits)

---

**Last Updated**: January 8, 2025
**Status**: Production Ready ✅
