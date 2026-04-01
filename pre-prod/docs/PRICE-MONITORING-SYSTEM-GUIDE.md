# Amazon Price Monitoring & Alert System

## Overview

This comprehensive system monitors your selected Amazon listings for price changes and competitor reactions, sending alerts when significant changes occur. It uses Amazon's SP-API competitive pricing endpoints to track changes in real-time.

## 🔍 What the Competitive Pricing API Provides

The `getCompetitivePricingBatch` API call returns detailed data for each ASIN:

```javascript
{
  "payload": [
    {
      "ASIN": "B07XYZ123",
      "Product": {
        "Offers": [
          {
            "SellerId": "A2D8NG39VURSL3",
            "SellerName": "Your Store Name",
            "ListingPrice": { "Amount": 15.99, "CurrencyCode": "GBP" },
            "Shipping": { "Amount": 0.00, "CurrencyCode": "GBP" },
            "IsBuyBoxWinner": true,
            "IsFulfilledByAmazon": true,
            "PrimeInformation": { "IsPrime": true },
            "FulfillmentChannel": "AMAZON"
          },
          {
            "SellerId": "COMPETITOR123",
            "SellerName": "Competitor Store",
            "ListingPrice": { "Amount": 16.49, "CurrencyCode": "GBP" },
            "Shipping": { "Amount": 3.99, "CurrencyCode": "GBP" },
            "IsBuyBoxWinner": false,
            "IsFulfilledByAmazon": false,
            "PrimeInformation": { "IsPrime": false }
          }
        ]
      }
    }
  ]
}
```

**Key Data Points Available:**
- ✅ **Real-time Buy Box ownership** (who's winning)
- ✅ **All competitor prices** (exact amounts)
- ✅ **Shipping costs** for each seller
- ✅ **Fulfillment methods** (FBA vs Merchant)
- ✅ **Prime eligibility** for each offer
- ✅ **Seller identification** (anonymized IDs)

## 🚀 System Components

### 1. **Batch Price Monitor Service** (`batch-price-monitor.js`)
- Monitors up to 20 ASINs per API call (batch processing)
- Respects Amazon's rate limits (35 requests/hour)
- Detects price changes, Buy Box ownership changes, competitive reactions
- Built-in rate limiting and error handling

### 2. **Database Tables** (`setup-price-monitoring-tables.sql`)
- **`price_monitoring_config`** - User monitoring preferences
- **`price_monitoring_history`** - Historical price data for comparisons
- **`price_monitoring_alerts`** - Alert audit trail
- **`price_monitoring_stats`** - System performance tracking

### 3. **CLI Management Tool** (`price-monitor-cli.js`)
- Start/stop monitoring service
- Add/remove items from monitoring
- Test alert systems
- View monitoring statistics

### 4. **UI Component** (`PriceMonitoringConfig.svelte`)
- Easy toggle monitoring on/off per ASIN/SKU
- Configure alert thresholds and priority levels
- View recent alerts and monitoring status

## 📊 Alert Types Generated

### **Buy Box Price Changes**
```javascript
{
  type: 'buy_box_price_change',
  severity: 'high', // if >10% change
  message: 'Buy Box price changed by -15.2% (-£2.50)',
  previousPrice: 16.45,
  currentPrice: 13.95,
  changePercent: -15.2
}
```

### **Buy Box Ownership Changes**
```javascript
{
  type: 'buy_box_ownership_change',
  severity: 'high', // if you lost Buy Box
  message: 'Lost Buy Box!',
  previousOwner: 'YOUR_SELLER_ID',
  currentOwner: 'COMPETITOR123'
}
```

### **Competitive Reactions**
```javascript
{
  type: 'competitive_reaction',
  severity: 'medium',
  message: 'Competitor reacted to your price change - dropped to £13.45',
  competitorChange: -1.00,
  // Triggered when competitor drops price within 2 hours of your change
}
```

## ⚙️ Setup Instructions

### 1. **Database Setup**
```bash
# Run the SQL setup file in your Supabase dashboard
psql -f setup-price-monitoring-tables.sql
```

### 2. **Environment Variables**
```env
# Required
AMAZON_SELLER_ID=A2D8NG39VURSL3
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PRIVATE_SUPABASE_SERVICE_KEY=your-service-key

# Optional - Email Alerts
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=alerts@yourstore.com

# Optional - Webhook Alerts
WEBHOOK_URL=https://your-webhook-endpoint.com/alerts
```

### 3. **Install Dependencies**
```bash
npm install nodemailer axios
```

## 🎮 Usage Examples

### **Start Monitoring (CLI)**
```bash
# Start monitoring every 15 minutes
node price-monitor-cli.js start 15

# Run single check and exit
node price-monitor-cli.js run-once
```

### **Add Items to Monitor**
```bash
# Add high-priority item with 3% threshold
node price-monitor-cli.js add-item \
  --asin B07XYZ123 \
  --sku CALLEBAUT-2.5KG-PRIME \
  --user jack@example.com \
  --priority 1 \
  --threshold 3.0 \
  --alerts '["email","webhook","database"]'
```

### **List Monitoring Configuration**
```bash
# List all monitored items
node price-monitor-cli.js list-items

# List items for specific user
node price-monitor-cli.js list-items --user jack@example.com
```

### **Test Alert System**
```bash
# Send test alerts to verify email/webhook setup
node price-monitor-cli.js test-alerts --user jack@example.com
```

## 🎯 Priority Levels & Monitoring Frequency

| Priority | Description | Check Frequency | Use Case |
|----------|-------------|----------------|----------|
| 1 - Critical | Instant alerts | Every 5-10 min | High-value, competitive items |
| 2 - High | Fast response | Every 15 min | Important profitable items |
| 3 - Medium | Standard monitoring | Every 30 min | Regular inventory |
| 4 - Low | Periodic checks | Every hour | Low-margin items |
| 5 - Monitor Only | Historical tracking | Daily | Analysis only |

## 📧 Alert Delivery Methods

### **Email Alerts**
- HTML formatted with item details
- Grouped by user and severity
- Automatic retry on delivery failure

### **Webhook Alerts**
- JSON payload for integration with external systems
- High-severity alerts only (to avoid spam)
- Slack, Discord, or custom endpoint integration

### **Database Logging**
- All alerts stored for audit trail
- Searchable by date, severity, ASIN
- User dashboard integration

## 🔒 Rate Limiting & Best Practices

### **Amazon SP-API Limits**
- **36 requests per hour** for competitive pricing
- **20 ASINs per batch request** (maximum efficiency)
- System automatically handles rate limiting and queuing

### **Monitoring Strategy**
```javascript
// Efficient batch grouping
const highPriorityItems = items.filter(i => i.priority <= 2); // Check every 15 min
const standardItems = items.filter(i => i.priority === 3);     // Check every 30 min
const lowPriorityItems = items.filter(i => i.priority >= 4);   // Check hourly/daily
```

### **Defensive Tactics**
- **Staggered monitoring times** to avoid predictable patterns
- **Random delays** between price checks
- **Competitor reaction detection** to identify automated followers

## 📈 Advanced Analytics

### **Price Change Patterns**
```sql
-- Find items with frequent competitor reactions
SELECT asin, sku, COUNT(*) as reaction_count
FROM price_monitoring_alerts
WHERE type = 'competitive_reaction'
AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY asin, sku
ORDER BY reaction_count DESC;
```

### **Buy Box Win Rate**
```sql
-- Calculate Buy Box ownership percentage
SELECT 
  asin,
  sku,
  AVG(CASE WHEN is_buy_box_yours THEN 1 ELSE 0 END) * 100 as win_rate_percent
FROM price_monitoring_history
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY asin, sku
ORDER BY win_rate_percent DESC;
```

## 🎨 UI Integration

Add the monitoring component to your buy-box-manager page:

```svelte
<script>
  import PriceMonitoringConfig from '$lib/components/PriceMonitoringConfig.svelte';
  import { userEmail } from '$lib/stores/userStore'; // Your user store
</script>

<!-- Add to each product row -->
<PriceMonitoringConfig 
  asin={item.asin}
  sku={item.sku}
  itemName={item.item_name}
  userEmail={$userEmail}
  currentPrice={item.your_current_price}
/>
```

## 🚨 Common Alert Scenarios

### **Scenario 1: Price War Detection**
- Your price: £15.99 → Competitor drops to £15.49
- System detects within 15 minutes
- Alert: "Competitive reaction detected"
- Recommendation: Monitor for 1 hour before responding

### **Scenario 2: Buy Box Loss**
- You lose Buy Box to competitor
- Immediate high-severity alert
- Analysis: Check if due to price, inventory, or performance metrics

### **Scenario 3: New Competitor Entry**
- New seller appears with aggressive pricing
- Alert includes competitor analysis
- Recommendation: Evaluate if sustainable pricing

## 🛠️ Troubleshooting

### **No Alerts Received**
1. Check monitoring is enabled: `node price-monitor-cli.js list-items`
2. Verify email settings: `node price-monitor-cli.js test-alerts --user your@email.com`
3. Check rate limiting: Review console logs for "Rate limited" messages

### **Missing Price Data**
1. Verify AMAZON_SELLER_ID environment variable
2. Check SP-API credentials and permissions
3. Review error logs in `price_monitoring_stats` table

### **Performance Issues**
1. Reduce monitoring frequency for low-priority items
2. Review batch sizes (max 20 ASINs per request)
3. Monitor API quota usage in stats table

This system provides comprehensive competitive intelligence while respecting Amazon's API limits and giving you the alerting flexibility you need to respond quickly to market changes.