# 📦 Buy Box Monitoring System - Implementation Task List

> This document tracks the implementation progress of the Buy Box Monitoring System based on the context engineering reference.

## 🎯 Project Goals

1. **Automated Scanning**: Schedule automatic scans of all Amazon listings to check Buy Box status
2. **Historical Tracking**: Log all scan results in Supabase for trend analysis
3. **Opportunity Flagging**: Identify listings where price adjustments could win back the Buy Box profitably
4. **Comprehensive Dashboard**:
   - Monitor current Buy Box performance
   - Review historical job runs
   - Investigate failed listings
   - Manually trigger live updates for any SKU
5. **Integration with Make.com**: Use Make.com to trigger scheduled scans

## 🔄 Progress Tracking

| Module | Progress |
|--------|----------|
| API Endpoints | 🟡 Partially Implemented |
| Database Setup | ⬜️ Not Started |
| Backend Logic | 🟡 Partially Implemented |
| Frontend Pages | 🟡 Partially Implemented |
| Testing & Validation | ⬜️ Not Started |

---

## 📋 Task Breakdown

### 1️⃣ API Endpoints Setup

- [ ] Create `/api/buybox/full-scan` endpoint for scheduled batch processing of all SKUs
- [x] Implement single-product Buy Box check endpoint
  - ✅ Existing endpoint: `/api/buy-box-monitor/check?asin=X` (rename to `/api/buybox/refresh`)
- [x] Implement Amazon SP-API integration for Buy Box data
  - ✅ Working through `my-buy-box-monitor.cjs` script
- [ ] Set up rate limiting (1 request/second + jitter)
- [ ] Implement retry logic with exponential backoff
- [ ] Create history logging endpoint to record scan results

### 2️⃣ Database Schema Implementation

- [ ] Create `buybox_data` table
  - ℹ️ Main table for storing all Buy Box scan results
  - ℹ️ Fields match schema from context document (id, run_id, asin, sku, price, is_winner, etc.)
  - ℹ️ Will include `opportunity_flag` based on profit calculation
- [ ] Create `buybox_jobs` table
  - ℹ️ For tracking scan job execution and progress
  - ℹ️ Will store success/failure counts and execution times
- [ ] Create `buybox_failures` table
  - ℹ️ For detailed error logging of failed SKUs
  - ℹ️ Will help with troubleshooting and optimizing the process
- [ ] Set up `skus` reference table (if not existing)
  - ℹ️ May need to extend existing table with additional fields like `min_price`
  - ℹ️ Could reuse cost/handling data already stored in other tables
- [ ] Create necessary indexes for performance
  - ℹ️ Index on sku, asin, run_id, and is_winner for faster lookups
  - ℹ️ Consider composite indexes for common queries
- [ ] Set up foreign key relationships
  - ℹ️ Link buybox_data to buybox_jobs via run_id
  - ℹ️ Link buybox_failures to buybox_jobs via job_id

### 3️⃣ Backend Logic

- [ ] Implement SKU randomization logic
- [ ] Build retry logic with backoff & jitter
- [ ] Implement profitability calculation logic
  - [ ] Calculate cost = cost + handling + shipping + estimatedFees
    - ℹ️ Can leverage existing logic from `/src/routes/api/inventory-profit-calculator/calculate/+server.ts`
    - ℹ️ Reference: Box cost lookup, shipping tier calculation, fragile charge lookup
  - [ ] Calculate margin = buyBoxPrice - totalCost
    - ℹ️ Use similar formula to inventory profit calculator: `amazonPrice - amazonFee - materialTotalCost - shippingCost`
  - [ ] Calculate marginPercent = margin / totalCost  
    - ℹ️ Similar to profit margin calculation in `inventory-profit-calculator`
  - [ ] Set opportunity_flag when margin > 0, marginPercent >= 0.10, and buyBoxPrice >= min_price
    - ℹ️ Will need to add min_price to SKU data table
- [ ] Create opportunity flag evaluation logic
  - [ ] Compare our calculated profitable price with current Buy Box price
  - [ ] Consider Amazon fees (default 15%) in calculations
- [ ] Implement job status tracking
  - [ ] Record job start/completion/failure
  - [ ] Track SKU processing counts (total/successful/failed)
- [ ] Build error logging system
  - [ ] Log API errors with detailed reasons

### 4️⃣ Frontend Implementation

#### Buy Box Monitor Page
- [x] Create dashboard layout
  - ✅ Basic dashboard with search functionality exists
  - ✅ Single product Buy Box status checking works
  - [ ] Update to support bulk results view from database
- [ ] Implement filtering (winner, opportunity, margin, category)
- [x] Add "Pull live data" functionality for individual products
  - [ ] Extend to support batch updates
- [ ] Implement 3-point trend/sparkline visualization
- [x] Create data refresh mechanism for individual products

#### Job History Page
- [ ] Display most recent job summary
- [ ] Show failure counts and details
- [ ] List failed SKUs with reasons
- [ ] Implement job history dropdown

### 5️⃣ Testing & Validation

- [ ] Test full-scan endpoint with sample data
- [ ] Validate retry logic handles errors properly
- [ ] Test profitability calculations
- [ ] Verify opportunity flag logic
- [ ] Validate frontend filters and displays
- [ ] Performance testing under load
- [ ] End-to-end workflow validation

---

## 🔮 Future Considerations (Not Part of Initial Implementation)

- [ ] Price automation via Listings API
- [ ] Slack/email alerts for opportunities
- [ ] Nightly cleanup job for `buybox_data`
- [ ] Fee API integration with Amazon
- [ ] Dashboard analytics scoring
- [ ] `monitoring_enabled` toggle functionality
- [ ] `low_margin_flag` detection
- [ ] `buybox_trend_score` tracking
- [ ] `buybox_summary` view for query optimization
- [ ] Weekly archive job
- [ ] Logging audit trail
- [ ] Category/brand filtering enhancements
- [ ] Access control roles

---

## 📝 Implementation Notes

- Use the naming conventions from the context document
- Add `// TODO:` comments for pending items
- Focus on readability and maintainable code
- Implement safe fallback logic for error cases
- Document all API endpoints and functions

---

> Last Updated: July 12, 2025
