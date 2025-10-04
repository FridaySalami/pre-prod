# Adding ASINs to Buy Box Monitoring

## Overview
The system polls ASINs based on their **priority level**. Here's how to add more ASINs:

## Method 1: Batch Setup (Recommended for Multiple ASINs)
Perfect for adding many ASINs at once with duplicate checking:

```bash
# 1. Check what's currently monitored
node list-current-asins.js

# 2. Edit configuration file with your ASINs
nano asin-batch-config.js

# 3. Run batch setup (automatically skips duplicates)
node batch-setup-asins.js
```

## Method 2: UI Dashboard
1. Go to: `http://localhost:5173/buy-box-alerts`
2. Browse available ASINs from your catalog
3. Click "Configure" to add monitoring
4. Set priority and alert preferences

## Monitoring Priorities & Frequencies

| Priority | Frequency | Use Case | Current Count |
|----------|-----------|----------|---------------|
| 1 - Critical | Every 15 min | High-competition, high-value products | 0 |
| 2 - High | Every hour | Important products with competition | 0 |
| 3 - Medium | Every 4 hours | Regular monitoring needed | 0 |
| 4 - Low | Twice daily | Stable products, occasional checks | 0 |
| 5 - Monitor | Daily | Basic monitoring, current products | 7 |

## Current Monitored ASINs
Your 7 current ASINs are all set to Priority 5 (daily monitoring):

1. **B0DJ95JVD3** - Crusha Milkshake Bundle - 0 competitors ✅
2. **B0DPJ458LV** - Duck Fat - 1 competitor ⚠️  
3. **B0DVJ17T8C** - Callebaut Dark Callets - 3 competitors ⚠️
4. **B085PN6X4C** - Valrhona Cocoa Powder - 0 competitors ✅
5. **B0DVS6YBJW** - Monin Passionfruit Syrup - 2 competitors ⚠️
6. **B0BGPMD867** - Spanish Olive Oil - 3 competitors ⚠️
7. **B09T3GDNGT** - Rowse Honey - 4 competitors ⚠️

## Recommendations
Consider upgrading high-competition products to higher priority:
- **B09T3GDNGT** (4 competitors) → Priority 2 (hourly)
- **B0DVJ17T8C** (3 competitors) → Priority 3 (every 4 hours)
- **B0BGPMD867** (3 competitors) → Priority 3 (every 4 hours)

## Adding New ASINs
1. Get ASIN and SKU from your inventory
2. Choose appropriate priority based on competition/importance
3. Add via UI or script
4. Monitor results in real-time dashboard

## Database Tables
- `price_monitoring_config` - Controls which ASINs to monitor
- `price_monitoring_alerts` - Stores monitoring results
- `amazon_listings` - Product data for display