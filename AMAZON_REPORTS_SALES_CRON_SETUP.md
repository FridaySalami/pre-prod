# Amazon Reports API - Sales Data Cron Job

## Overview

This system fetches daily sales and traffic data from Amazon's Reports API and stores it in Supabase for use in the Buy Box product pages.

**Status**: ✅ Core implementation complete  
**Next Step**: Configure cron trigger  
**Date Created**: 14 October 2025

---

## 🏗️ Architecture

```
External Cron (Render/GitHub Actions)
  ↓ (Daily at 2:00 AM UTC)
  ↓ POST /api/cron/daily-sales-report
  ↓
ReportsService
  ├─ Request report from Amazon
  ├─ Poll status (15-20 min wait)
  ├─ Download & decompress
  └─ Return JSON data
  ↓
SalesProcessor
  ├─ Parse JSON
  ├─ Extract per-ASIN metrics
  ├─ Validate data
  └─ Upsert to Supabase
  ↓
Database (amazon_sales_data table)
  ↓
Product Page API
  ↓ GET /api/sales/[asin]/summary
  ↓
Product Page UI (30-Day Revenue box)
```

---

## 📊 Database Schema

### `amazon_sales_data`
Stores daily sales/traffic metrics per ASIN.

```sql
CREATE TABLE amazon_sales_data (
  id SERIAL PRIMARY KEY,
  asin VARCHAR(10) NOT NULL,
  parent_asin VARCHAR(10),
  sku VARCHAR(100),
  report_date DATE NOT NULL,
  
  -- Sales Metrics
  ordered_units INTEGER DEFAULT 0,
  ordered_product_sales DECIMAL(10,2) DEFAULT 0.00,
  total_order_items INTEGER DEFAULT 0,
  
  -- Traffic Metrics
  sessions INTEGER DEFAULT 0,
  session_percentage DECIMAL(5,2),
  page_views INTEGER DEFAULT 0,
  page_views_percentage DECIMAL(5,2),
  
  -- Conversion Metrics
  unit_session_percentage DECIMAL(5,2),
  buy_box_percentage DECIMAL(5,2),
  
  -- Other Metrics
  average_sales_price DECIMAL(10,2),
  average_offer_count INTEGER,
  
  -- Metadata
  marketplace_id VARCHAR(20) DEFAULT 'A1F83G8C2ARO7P',
  currency_code VARCHAR(3) DEFAULT 'GBP',
  report_id VARCHAR(100),
  imported_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(asin, report_date, marketplace_id)
);
```

### `report_job_logs`
Tracks cron job execution for monitoring and debugging.

```sql
CREATE TABLE report_job_logs (
  id SERIAL PRIMARY KEY,
  job_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  report_id VARCHAR(100),
  report_type VARCHAR(100),
  report_document_id VARCHAR(100),
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  error_message TEXT,
  error_code VARCHAR(50),
  retry_count INTEGER DEFAULT 0,
  date_range_start DATE,
  date_range_end DATE,
  marketplace_id VARCHAR(20) DEFAULT 'A1F83G8C2ARO7P'
);
```

---

## 🔧 Implementation Files

### 1. **Database Migrations**
- `supabase/migrations/20251014000001_create_amazon_sales_data.sql`
- `supabase/migrations/20251014000002_create_report_job_logs.sql`

**To Apply:**
```bash
cd supabase
npx supabase db push
```

### 2. **Reports Service**
`src/lib/amazon/reports-service.ts`

**Key Methods:**
- `requestReport(options)` - Request a new report
- `pollReportStatus(reportId)` - Wait for completion
- `getReportDocument(documentId)` - Get download URL
- `downloadReport(url)` - Download and decompress
- `requestAndWaitForReport(options)` - Complete flow
- `logJobStart/Complete/Failed()` - Logging utilities

### 3. **Sales Processor**
`src/lib/amazon/sales-processor.ts`

**Key Methods:**
- `processSalesReport(data, reportId)` - Parse and store
- `get30DaySummary(asin)` - Get aggregated metrics
- `getSalesTrend(asin, days)` - Get time-series data

### 4. **Cron Job Endpoint**
`src/routes/api/cron/daily-sales-report/+server.ts`

**Authentication**: Requires `CRON_SECRET` in Authorization header

**Flow:**
1. Verify `Authorization: Bearer <CRON_SECRET>`
2. Request yesterday's sales report
3. Poll until complete (max 20 minutes)
4. Download and process data
5. Store in database
6. Log execution details

### 5. **Sales Query API**
`src/routes/api/sales/[asin]/summary/+server.ts`

**Usage:**
```bash
GET /api/sales/B0087OSN0A/summary
```

**Response:**
```json
{
  "asin": "B0087OSN0A",
  "days": 30,
  "totalRevenue": 1234.56,
  "totalUnits": 45,
  "totalSessions": 890,
  "totalPageViews": 2340,
  "avgConversionRate": 5.06,
  "avgBuyBoxPercentage": 85.3,
  "avgSalesPrice": 27.43,
  "latestData": { ... },
  "oldestData": { ... }
}
```

---

## 🚀 Setup Instructions

### Step 1: Apply Database Migrations

```bash
cd /Users/jackweston/Projects/pre-prod
npx supabase db push
```

### Step 2: Set Environment Variable

Add to `.env`:
```bash
CRON_SECRET="your-random-secret-here"
```

Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3: Choose Cron Trigger Method

#### **Option A: Render Cron Jobs (Recommended)**

1. Go to Render Dashboard
2. Navigate to your service
3. Add a new Cron Job:
   - **Name**: Daily Sales Report
   - **Command**: N/A (we'll use HTTP request)
   - **Schedule**: `0 2 * * *` (Daily at 2:00 AM UTC)
   - **Type**: HTTP Request
   - **URL**: `https://your-app.onrender.com/api/cron/daily-sales-report`
   - **Method**: POST
   - **Headers**: `Authorization: Bearer YOUR_CRON_SECRET`

#### **Option B: GitHub Actions**

Create `.github/workflows/daily-sales-report.yml`:

```yaml
name: Daily Sales Report

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2:00 AM UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  fetch-sales-report:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Sales Report Cron
        run: |
          curl -X POST "${{ secrets.APP_URL }}/api/cron/daily-sales-report" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

Add secrets in GitHub repository settings:
- `APP_URL`: Your production URL
- `CRON_SECRET`: Same as your `.env` value

#### **Option C: External Service (EasyCron, cron-job.org)**

1. Sign up for service
2. Create new cron job:
   - URL: `https://your-app.onrender.com/api/cron/daily-sales-report`
   - Method: POST
   - Schedule: `0 2 * * *`
   - Headers: `Authorization: Bearer YOUR_CRON_SECRET`

---

## 🧪 Testing

### Test Cron Job Locally

```bash
# Start dev server
npm run dev

# In another terminal, trigger cron job
curl -X POST http://localhost:3000/api/cron/daily-sales-report \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Test Sales Query API

```bash
# After cron job has run at least once
curl http://localhost:3000/api/sales/B0087OSN0A/summary
```

### Check Job Logs

```sql
-- View recent job executions
SELECT 
  id,
  job_type,
  status,
  started_at,
  duration_seconds,
  records_processed,
  error_message
FROM report_job_logs
ORDER BY started_at DESC
LIMIT 10;

-- View sales data for specific ASIN
SELECT *
FROM amazon_sales_data
WHERE asin = 'B0087OSN0A'
ORDER BY report_date DESC
LIMIT 30;
```

---

## 📈 Monitoring

### Check Cron Job Status

```bash
# View job logs in database
SELECT * FROM report_job_logs 
WHERE job_type = 'daily_sales_report' 
ORDER BY started_at DESC 
LIMIT 5;
```

### Common Issues

**Problem**: Cron job times out  
**Solution**: Amazon reports can take 15-20 minutes. Increase timeout if possible, or split into two jobs (request + download).

**Problem**: No data for certain ASINs  
**Solution**: Amazon only includes ASINs with activity. Zero-sales products won't appear in reports.

**Problem**: Duplicate data  
**Solution**: UPSERT logic handles this automatically. Check `report_job_logs` for multiple executions.

---

## 🎯 Next Steps

1. **Apply Migrations**: Run `npx supabase db push`
2. **Set CRON_SECRET**: Add to `.env` and Render environment
3. **Configure Cron Trigger**: Choose method (Render/GitHub Actions/External)
4. **Update Product Page**: Replace mock revenue box with real data
5. **Test End-to-End**: Trigger manually and verify data flow
6. **Monitor First Week**: Check job logs daily

---

## 📝 Rate Limits

Amazon Reports API has strict rate limits:

- **Request Report**: 0.0167 req/sec (1 per 60 seconds) ⚠️
- **Get Report**: 2 req/sec
- **Get Report Document**: 0.0167 req/sec (1 per 60 seconds) ⚠️

Our implementation respects these limits through the `SPAPIClient` rate limiting.

---

## 💡 Future Enhancements

1. **Backfill Historical Data**: Request reports for past 60-90 days
2. **Weekly/Monthly Aggregates**: Pre-calculate for faster queries
3. **Alert on Anomalies**: Notify when sales drop unexpectedly
4. **Retry Logic**: Auto-retry failed report requests
5. **Multiple Report Types**: Add inventory, returns, customer feedback reports

---

## 🔐 Security

- Cron endpoint requires `CRON_SECRET` authentication
- Never commit `CRON_SECRET` to git
- Rotate secret quarterly
- Use Supabase RLS policies if exposing sales data to frontend

---

## ✅ Completion Checklist

- [x] Database migrations created
- [x] ReportsService implemented
- [x] SalesProcessor implemented
- [x] Cron job endpoint created
- [x] Sales query API created
- [ ] Migrations applied to Supabase
- [ ] CRON_SECRET configured
- [ ] Cron trigger configured
- [ ] Product page updated
- [ ] End-to-end test completed
- [ ] Monitoring dashboard created

---

**Created**: 14 October 2025  
**Status**: Ready for deployment  
**Owner**: Jack Weston
