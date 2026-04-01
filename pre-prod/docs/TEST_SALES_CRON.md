# Test Daily Sales Report Cron Job

## Quick Test (Recommended)

**Make sure your dev server is running first:**
```bash
npm run dev
```

**Then in another terminal, run:**

### Option 1: Simple Curl (Fastest)
```bash
curl -X POST http://localhost:3000/api/cron/daily-sales-report \
  -H "Authorization: Bearer c190c473e2996bafa89d02dfc18225cd858a4371f23eaefa588a499d0b5540f1" \
  -H "Content-Type: application/json"
```

### Option 2: Bash Script
```bash
./test-cron-simple.sh
```

### Option 3: Node Script (Most Detailed)
```bash
node test-sales-cron.js
```

---

## What to Expect

The cron job will:
1. ✅ Authenticate using CRON_SECRET
2. 📅 Request yesterday's sales report from Amazon
3. ⏳ Poll for 15-20 minutes until report is ready
4. 📥 Download and decompress the report
5. 💾 Process and store data in Supabase
6. 📊 Return processing statistics

**Total Time**: 15-25 minutes (Amazon report generation takes time)

---

## Response Format

### Success Response:
```json
{
  "success": true,
  "reportId": "amzn1.spdoc.1...",
  "documentId": "amzn1.tortuga.3...",
  "stats": {
    "processed": 150,
    "updated": 25,
    "failed": 0,
    "errors": []
  },
  "duration": 1234,
  "date": "2025-10-13"
}
```

### Error Response:
```json
{
  "success": false,
  "error": "Report timeout - still IN_PROGRESS after 20 minutes",
  "reportId": "amzn1.spdoc.1...",
  "duration": 1200
}
```

---

## Verify Data Was Stored

### Check Job Logs:
```sql
SELECT 
  id,
  job_type,
  status,
  started_at,
  completed_at,
  duration_seconds,
  records_processed,
  records_failed,
  error_message
FROM report_job_logs
ORDER BY started_at DESC
LIMIT 5;
```

### Check Sales Data:
```sql
-- Count total records
SELECT COUNT(*) FROM amazon_sales_data;

-- View latest records
SELECT 
  asin,
  report_date,
  ordered_product_sales,
  ordered_units,
  sessions,
  unit_session_percentage
FROM amazon_sales_data
ORDER BY imported_at DESC
LIMIT 10;

-- Summary by ASIN
SELECT 
  asin,
  COUNT(*) as days_of_data,
  SUM(ordered_product_sales) as total_revenue,
  SUM(ordered_units) as total_units
FROM amazon_sales_data
GROUP BY asin
ORDER BY total_revenue DESC
LIMIT 10;
```

---

## Troubleshooting

### 401 Unauthorized
❌ **Problem**: Wrong CRON_SECRET  
✅ **Solution**: Check that CRON_SECRET in .env matches the one in curl command

### 500 Error - Authentication Failed
❌ **Problem**: SP-API credentials issue  
✅ **Solution**: Verify Amazon credentials in .env (AMAZON_CLIENT_ID, AMAZON_CLIENT_SECRET, AMAZON_REFRESH_TOKEN)

### Report Timeout
❌ **Problem**: Amazon taking too long to generate report  
✅ **Solution**: This is normal for first run. Increase timeout or try again later.

### No Data Returned
❌ **Problem**: No sales yesterday  
✅ **Solution**: Amazon only includes ASINs with activity. Try testing with a date range that has sales.

---

## Manual Testing with Specific Date Range

You can modify the cron endpoint temporarily to test with a specific date:

```typescript
// In +server.ts, change:
const yesterday = new Date('2025-10-10'); // Specific date with known sales
```

---

## Check Endpoint Status (No Auth Required)

```bash
curl http://localhost:3000/api/cron/daily-sales-report
```

Returns endpoint info without running the job.

---

## Production Testing

Once deployed to Render:

```bash
curl -X POST https://your-app.onrender.com/api/cron/daily-sales-report \
  -H "Authorization: Bearer YOUR_PRODUCTION_CRON_SECRET" \
  -H "Content-Type: application/json"
```

---

## Next Steps After Successful Test

1. ✅ Verify data is in database
2. ✅ Test sales query API: `GET /api/sales/[asin]/summary`
3. ✅ Update product page to show real revenue
4. ✅ Configure Render Cron Job to run daily at 2 AM UTC
