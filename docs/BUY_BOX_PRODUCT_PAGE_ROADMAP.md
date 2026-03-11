# Buy Box Product Detail Page - Implementation Roadmap

**Project**: Pre-Prod Buy Box Monitoring System  
**Page**: `/buy-box-alerts/product/[asin]`  
**Goal**: Replace all mock data with real Amazon SP-API integrations  
**Date Created**: 13 October 2025

---

## 📋 Executive Summary

This document outlines the complete path to transform the Buy Box Product Detail page from its current state (mix of real and mock data) to a fully functional analytics dashboard powered entirely by Amazon SP-API data.

**Current State**: 
- ✅ 75% Complete - Price tracking, competitor analysis, catalog data, and FBM fees working
- ✅ Catalog API - Product images, titles, brands, categories, dimensions integrated
- ✅ Fees API - FBM-accurate fee calculations with referral fees
- ⚠️ 25% Mock Data - Revenue, reviews, listing health, and keywords are placeholders

**Target State**: 
- 🎯 100% Real Data - All metrics powered by Amazon APIs
- 📊 Enhanced Analytics - Sales trends, review analysis, BSR tracking
- ⚡ Real-time Updates - Live data refresh capabilities

---

## 🎯 Implementation Phases

### **PHASE 1: Foundation & Quick Wins** 
**Timeline**: 3-5 days  
**Goal**: Fix existing data gaps and set up core API infrastructure

#### Task 1.1: Fix Prime & FBA Offer Counts ⚡ PRIORITY
**Status**: 🟡 Data exists but not displayed correctly  
**Effort**: 2 hours  
**Files to Modify**:
- `src/routes/api/buy-box-alerts/product/[asin]/+server.ts`
- `src/routes/buy-box-alerts/product/[asin]/+page.svelte`

**Implementation**:
```typescript
// In +server.ts, add to currentState calculation:
const latestNotification = history[0];
const totalPrimeOffers = latestNotification?.competitorPrices?.filter(c => c.isPrime).length + 
                         (latestNotification?.yourOffer?.isPrime ? 1 : 0);
const competitiveFbaOffers = latestNotification?.competitorPrices?.filter(c => c.isFBA).length + 
                             (latestNotification?.yourOffer?.isFBA ? 1 : 0);
```

**Acceptance Criteria**:
- [x] Prime offer count accurately reflects current state
- [x] FBA offer count includes all FBA sellers
- [x] Counts update with each new notification
- [x] Display on product page instead of placeholder

---

#### Task 1.2: Amazon SP-API Credentials Setup
**Status**: ✅ COMPLETE  
**Effort**: 1 hour  
**Dependencies**: Access to Amazon Seller Central
**Completed**: October 13, 2025

**Implementation Steps**:
1. ✅ Verified existing SP-API credentials in `.env`
2. ✅ Confirmed required scopes are enabled:
   - `sellingpartnerapi::notifications` (already working)
   - `sellingpartnerapi::catalog` ✅ WORKING - Catalog Items API v2022-04-01
   - `sellingpartnerapi::fees` ✅ WORKING - Product Fees API v0
3. ✅ Test authentication with new scopes
4. ✅ Discovered External ID requirement (Seller Partner ID)
5. ✅ Implemented STS AssumeRole with External ID

**Files to Check**:
- `.env` (credentials)
- `src/lib/amazon-sp-api-client.ts` (if exists)
- Existing API files for auth patterns

**Acceptance Criteria**:
- [x] All required API scopes are enabled
- [x] Authentication works for new endpoints
- [x] Refresh token rotation implemented
- [x] Rate limiting strategy documented

---

#### Task 1.3: Create Shared SP-API Client Library
**Status**: ✅ COMPLETE  
**Effort**: 4 hours  
**Purpose**: Reusable client for all Amazon API calls
**Completed**: October 13, 2025

**Implementation**:
```typescript
// ✅ src/lib/amazon/sp-api-client.ts - IMPLEMENTED
export class SPAPIClient {
  ✅ Authentication handling with LWA
  ✅ STS AssumeRole with External ID (CRITICAL)
  ✅ Rate limiting (dynamic adjustment)
  ✅ Token refresh and caching
  ✅ Error handling with retries
}
```

**Features**:
- ✅ Rate limiter with dynamic adjustment (adaptive to API responses)
- ✅ Automatic retry on 429 (rate limit) errors
- ✅ Request queue management
- ✅ Error categorization (auth, rate, server, network)
- ✅ Response caching layer (STS 50-55 min, LWA 55 min)
- ✅ External ID support for STS AssumeRole

**Files to Create**:
- ✅ `src/lib/amazon/sp-api-client.ts` - COMPLETE
- ✅ `src/lib/amazon/rate-limiter.ts` - Integrated into sp-api-client
- ✅ `src/lib/amazon/types.ts` - COMPLETE

**Acceptance Criteria**:
- ✅ Client handles authentication automatically
- ✅ Rate limiting prevents 429 errors
- ✅ Retries work for transient failures
- ✅ Used by Catalog API and Fees API endpoints
- ⚠️ Unit tests - Not yet implemented

---

### **PHASE 2: Product Catalog Integration**
**Timeline**: 5-7 days  
**Goal**: Get core product data from Amazon Catalog API
**Status**: ✅ COMPLETE (October 13, 2025)

#### Task 2.1: Product Catalog API Integration
**Status**: ✅ COMPLETE  
**Effort**: 6 hours  
**API**: `GET /catalog/2022-04-01/items/{asin}`
**Completed**: October 13, 2025

**What This Provides**:
- ✅ Product title, brand, manufacturer
- ✅ Product dimensions & weight
- ✅ Image URLs (up to 8 images supported)
- ✅ Product category & subcategories
- ✅ Feature bullets (5 key features)
- ⚠️ Product description (not fully extracted yet)
- ⚠️ Limited review data (count only, not rating)
- ✅ Package dimensions for FBA fee calculation

**Implementation**:
```typescript
// ✅ src/lib/amazon/catalog-service.ts - COMPLETE (201 lines)
// Methods implemented:
✅ getProduct(asin) - Full product details
✅ getProductTitle(asin) - Quick title fetch
✅ getProductTitles(asins[]) - Batch fetch
✅ parseProduct() - Extract structured data

// ✅ Integrated in +page.server.ts
catalogData = await catalogService.getProduct(asin);
```

**Test Results**:
```
✅ ASIN B08BPCC8WD tested successfully
✅ Title: Major Gluten Free Vegetable Stock Powder Mix - 2x1kg
✅ Brand: MAJOR
✅ Category: Flavouring Powders
✅ Images: 3 product images retrieved
✅ Dimensions: 10.24 × 5.12 × 5.12 inches, 4.76 lbs
```

**Database Schema**:
```sql
-- ⚠️ NOT YET IMPLEMENTED - Currently fetching fresh data each time
-- TODO: Implement caching to reduce API calls
CREATE TABLE amazon_catalog_cache (
  id SERIAL PRIMARY KEY,
  asin VARCHAR(10) NOT NULL UNIQUE,
  marketplace_id VARCHAR(20) NOT NULL,
  title TEXT,
  brand VARCHAR(255),
  manufacturer VARCHAR(255),
  product_category VARCHAR(255),
  bullet_points TEXT[], -- Array of 5 bullets
  description TEXT,
  image_urls TEXT[], -- Array of image URLs
  dimensions JSONB, -- {length, width, height, weight}
  package_dimensions JSONB,
  attributes JSONB, -- All other attributes
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_catalog_asin ON amazon_catalog_cache(asin);
CREATE INDEX idx_catalog_updated ON amazon_catalog_cache(updated_at);
```

**Caching Strategy**:
- ⚠️ TODO: Cache for 7 days (product details rarely change)
- ⚠️ TODO: Force refresh if user requests
- ⚠️ TODO: Background job: Update all monitored ASINs weekly

**Files to Create**:
- ✅ `src/lib/amazon/catalog-service.ts` - COMPLETE
- ⚠️ `migrations/add-catalog-cache-table.sql` - TODO

**Acceptance Criteria**:
- ✅ API successfully fetches catalog data for any ASIN
- ⚠️ Data cached in database with 7-day TTL - TODO
- ✅ Product images display on page
- ✅ Bullet points/features extracted and displayed
- ✅ Dimensions available for fee calculation
  attributes JSONB, -- Full attributes object
  raw_response JSONB,
  fetched_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_catalog_asin ON amazon_catalog_cache(asin);
CREATE INDEX idx_catalog_updated ON amazon_catalog_cache(updated_at);
```

**Caching Strategy**:
- Cache for 7 days (product details rarely change)
- Force refresh if user requests
- Background job: Update all monitored ASINs weekly

**Files to Create**:
- `src/routes/api/amazon/catalog/[asin]/+server.ts`
- `src/lib/amazon/catalog-service.ts`
- `migrations/add-catalog-cache-table.sql`

**Acceptance Criteria**:
- [x] API successfully fetches catalog data for any ASIN
- [x] Data cached in database with 7-day TTL
- [x] Product images display on page
- [x] Bullet points extracted and displayed
- [x] Dimensions available for FBA fee calculation

---

#### Task 2.2: Extract & Display Keywords from Catalog
**Status**: ✅ COMPLETE  
**Effort**: 3 hours  
**Dependencies**: Task 2.1 complete
**Completed**: October 13, 2025

**Implementation Strategy**:
Since Amazon doesn't provide keyword rankings via API, we implemented:
1. ✅ Extract keywords from product title (highest weight: 3.0x)
2. ✅ Parse feature bullets for repeated terms (medium weight: 1.5x)
3. ✅ Include category terms (lower weight: 1.0x)
4. ✅ Apply NLP to identify key product terms
5. ✅ Display top 5 primary + 5 secondary keywords

**Algorithm**:
```typescript
// ✅ src/lib/utils/keyword-extractor.ts - IMPLEMENTED (295 lines)
export function extractKeywords(title, bullets, category, brand) {
  1. Tokenize title + bullets (remove stop words)
  2. Calculate position weight (earlier = higher)
  3. Calculate frequency weight (repeated = higher)
  4. Boost brand names by 1.5x
  5. Return top 10 ranked by combined score
}
```

**Example Output**:
```
ASIN: B08BPCC8WD
Title: "Major Gluten Free Vegetable Stock Powder Mix - 2x1kg"
→ Keywords: Major, Gluten, Free, Vegetable, Powder
→ Related: Mix, 2x1kg, Flavouring
```

**Files Created**:
- ✅ `src/lib/utils/keyword-extractor.ts` - Complete (295 lines)
- ✅ `test-keyword-extraction.ts` - Tests with real products

**Files Modified**:
- ✅ `src/lib/amazon/catalog-service.ts` - Added keywords field
- ✅ `src/routes/buy-box-alerts/product/[asin]/+page.svelte` - Display UI

**Acceptance Criteria**:
- ✅ Extracts 5-10 relevant keywords per product
- ✅ Prioritizes product-specific terms over generic words
- ✅ Updates when catalog data refreshes
- ✅ Displays on product detail page with visual badges
- ✅ Tested with multiple product types (stock powder, olive oil, etc.)

---

#### Task 2.3: Listing Health Score Calculator
**Status**: ⚪ Not Started  
**Effort**: 8 hours  
**Dependencies**: Task 2.1 complete

**Health Score Formula** (0-10 scale):

```
Listing Health Score = (
  Content Completeness (30%) +
  Image Quality (25%) +
  Competitive Position (25%) +
  Buy Box Performance (20%)
) / 4
```

**Component Breakdown**:

**1. Content Completeness Score (0-3 points)**:
```typescript
- Title length >= 80 chars: 0.6 pts
- 5 bullet points filled: 0.6 pts
- Description >= 500 chars: 0.6 pts
- Brand name present: 0.6 pts
- Key attributes filled: 0.6 pts
```

**2. Image Quality Score (0-2.5 points)**:
```typescript
- Image count >= 7: 1.0 pt
- Image count 5-6: 0.7 pts
- Image count 3-4: 0.4 pts
- Has lifestyle images: 0.5 pts
- Images > 1000px: 0.5 pts
- Has infographic: 0.5 pts
```

**3. Competitive Position Score (0-2.5 points)**:
```typescript
- Your rank <= 3: 1.0 pt
- Your rank 4-10: 0.6 pts
- Your rank > 10: 0.2 pts
- Price within 10% of market low: 0.8 pts
- Total offers < 15: 0.7 pts (less competition)
```

**4. Buy Box Performance (0-2 points)**:
```typescript
- Buy Box win rate >= 80%: 1.0 pt
- Buy Box win rate 50-79%: 0.6 pts
- Buy Box win rate < 50%: 0.2 pts
- Currently has buy box: 0.5 pts
- FBA enabled: 0.5 pts
```

**Implementation**:
```typescript
// src/lib/amazon/listing-health.ts
export function calculateListingHealth(
  catalogData,
  competitorData,
  buyBoxHistory
): ListingHealthScore {
  // Returns object with score + breakdown
}
```

**Database Schema**:
```sql
CREATE TABLE listing_health_scores (
  id SERIAL PRIMARY KEY,
  asin VARCHAR(10) NOT NULL,
  overall_score DECIMAL(3,1), -- 0.0 to 10.0
  content_score DECIMAL(3,1),
  image_score DECIMAL(3,1),
  competitive_score DECIMAL(3,1),
  buybox_score DECIMAL(3,1),
  breakdown JSONB, -- Detailed component scores
  recommendations TEXT[], -- Array of improvement suggestions
  calculated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (asin) REFERENCES current_state(asin)
);

CREATE INDEX idx_health_asin ON listing_health_scores(asin);
```

**Visual Display**:
```
Listing Health Score: 8.7/10 ●●●●●●●●○○

Breakdown:
✅ Content: 9/10 (Excellent)
✅ Images: 8/10 (Good) 
⚠️ Position: 7/10 (Could improve)
✅ Buy Box: 9/10 (Excellent)

Recommendations:
• Add 2 more product images
• Reduce price by 5% to improve position
```

**Files to Create**:
- `src/lib/amazon/listing-health.ts`
- `src/routes/api/listing-health/[asin]/+server.ts`
- `migrations/add-listing-health-table.sql`

**Acceptance Criteria**:
- [x] Score calculation matches formula
- [x] Breakdown shows component scores
- [x] Recommendations are actionable
- [x] Score updates daily
- [x] Visual representation on page

---

### **PHASE 3: Sales & Traffic Reports**
**Timeline**: 7-10 days  
**Goal**: Get historical sales data from Amazon Reports API

#### Task 3.1: Reports API Integration - Setup
**Status**: ⚪ Not Started  
**Effort**: 6 hours  
**API**: `POST /reports/2021-06-30/reports`

**Report Types Needed**:
1. **GET_SALES_AND_TRAFFIC_REPORT** - Overall business metrics
2. **GET_MERCHANT_LISTINGS_ALL_DATA** - Current listing details

**How Amazon Reports Work**:
```
1. Request report → Get reportId
2. Poll report status (5-15 min wait)
3. Get reportDocumentId when complete
4. Download report document (JSON/CSV)
5. Parse and store data
```

**Implementation Flow**:
```typescript
// src/lib/amazon/reports-service.ts

1. requestReport(reportType, startDate, endDate)
   → Returns: reportId

2. pollReportStatus(reportId) 
   → Returns: status (IN_QUEUE, IN_PROGRESS, DONE, CANCELLED, FATAL)

3. getReportDocument(reportDocumentId)
   → Returns: download URL (expires in 5 min)

4. downloadAndDecompress(url)
   → Returns: parsed data

5. storeReportData(data)
   → Saves to database
```

**Rate Limits**:
- Request Report: 0.0167 requests/second (1 every 60 seconds)
- Get Report: 2 requests/second
- Very restrictive! Need careful scheduling

**Files to Create**:
- `src/lib/amazon/reports-service.ts`
- `src/routes/api/amazon/reports/request/+server.ts`
- `src/routes/api/amazon/reports/status/[reportId]/+server.ts`
- `src/routes/api/amazon/reports/download/[reportId]/+server.ts`

**Acceptance Criteria**:
- [x] Can request sales reports
- [x] Polling works with proper intervals
- [x] Downloads decompress correctly
- [x] Handles report failures gracefully
- [x] Respects rate limits

---

#### Task 3.2: Sales Data Storage & Processing
**Status**: ⚪ Not Started  
**Effort**: 8 hours  
**Dependencies**: Task 3.1 complete

**Database Schema**:
```sql
CREATE TABLE amazon_sales_data (
  id SERIAL PRIMARY KEY,
  asin VARCHAR(10) NOT NULL,
  parent_asin VARCHAR(10), -- For variations
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
  unit_session_percentage DECIMAL(5,2), -- Conversion rate
  buy_box_percentage DECIMAL(5,2),
  
  -- Other Metrics
  average_sales_price DECIMAL(10,2),
  average_offer_count INTEGER,
  
  -- Metadata
  marketplace_id VARCHAR(20) DEFAULT 'A1F83G8C2ARO7P',
  currency_code VARCHAR(3) DEFAULT 'GBP',
  report_id VARCHAR(100),
  imported_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(asin, report_date, marketplace_id)
);

CREATE INDEX idx_sales_asin_date ON amazon_sales_data(asin, report_date DESC);
CREATE INDEX idx_sales_date ON amazon_sales_data(report_date DESC);
CREATE INDEX idx_sales_asin ON amazon_sales_data(asin);
```

**Processing Logic**:
```typescript
// src/lib/amazon/sales-processor.ts

export async function processSalesReport(reportData) {
  // Reports come with data for ALL products
  // Need to:
  1. Parse JSON/CSV format
  2. Extract per-ASIN metrics
  3. Handle date ranges
  4. Deduplicate (reports can overlap)
  5. Calculate derived metrics
  6. Store in database
}
```

**Aggregation Queries**:
```sql
-- 30-day revenue for specific ASIN
SELECT 
  SUM(ordered_product_sales) as revenue_30d,
  SUM(ordered_units) as units_30d,
  AVG(unit_session_percentage) as avg_conversion_rate
FROM amazon_sales_data
WHERE asin = $1
  AND report_date >= CURRENT_DATE - INTERVAL '30 days'
  AND report_date < CURRENT_DATE;
```

**Files to Create**:
- `src/lib/amazon/sales-processor.ts`
- `migrations/add-amazon-sales-data-table.sql`
- `src/routes/api/sales/[asin]/summary/+server.ts`

**Acceptance Criteria**:
- [x] Reports parse correctly (JSON & CSV)
- [x] Data stored without duplicates
- [x] Can query 30-day aggregates
- [x] Handles missing data gracefully
- [x] Performance: <100ms for 30-day query

---

#### Task 3.3: Automated Report Scheduling
**Status**: ⚪ Not Started  
**Effort**: 6 hours  
**Dependencies**: Task 3.2 complete

**Scheduling Strategy**:
- **Daily at 2:00 AM UTC**: Request previous day's report
- **Wait 15 minutes**: Allow report generation
- **Poll every 2 minutes**: Check if ready
- **Download & Process**: When complete
- **Retry**: If fails, retry 3 times with 1hr delay

**Implementation Options**:

**Option A: Cron Job (Recommended)**
```typescript
// cron-jobs/daily-sales-report.ts
- Runs on server via cron
- Uses node-cron or system cron
- Logs to database
```

**Option B: SvelteKit API Route**
```typescript
// src/routes/api/cron/daily-sales/+server.ts
- Called by external cron (GitHub Actions, Render Cron)
- Includes auth token check
```

**Cron Expression**: `0 2 * * *` (Every day at 2 AM)

**Monitoring**:
```sql
CREATE TABLE report_job_logs (
  id SERIAL PRIMARY KEY,
  job_type VARCHAR(50), -- 'daily_sales_report'
  status VARCHAR(20), -- 'started', 'completed', 'failed'
  report_id VARCHAR(100),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  records_processed INTEGER
);
```

**Files to Create**:
- `cron-jobs/daily-sales-report.ts`
- `src/routes/api/cron/daily-sales/+server.ts`
- `migrations/add-report-job-logs-table.sql`

**Acceptance Criteria**:
- [x] Reports requested daily automatically
- [x] Failures are logged and retried
- [x] Data appears in database next day
- [x] Can view job history/status
- [x] Email alerts on repeated failures

---

#### Task 3.4: Display Sales Metrics on Product Page
**Status**: ⚪ Not Started  
**Effort**: 4 hours  
**Dependencies**: Task 3.2 complete

**New API Endpoint**:
```typescript
// GET /api/sales/[asin]/summary?days=30
Response: {
  revenue_30d: 23556.35,
  units_30d: 45875,
  avg_daily_revenue: 785.21,
  avg_daily_units: 1529.17,
  conversion_rate: 12.5,
  sessions_30d: 367000,
  buy_box_percentage: 87.5,
  trend: {
    revenue_change_7d: "+12.5%",
    units_change_7d: "+8.2%"
  }
}
```

**Page Updates**:
```svelte
<!-- Replace placeholderMetrics with real data -->
{#if data.salesMetrics}
  <div class="text-3xl font-bold">
    {formatCurrency(data.salesMetrics.revenue_30d)}
  </div>
  <div class="text-xs text-gray-500">
    Unit Sales: {data.salesMetrics.units_30d.toLocaleString()}
  </div>
  <div class="text-green-600 text-sm">
    ↑ {data.salesMetrics.trend.revenue_change_7d} vs last week
  </div>
{:else}
  <div class="text-gray-400">No sales data available</div>
{/if}
```

**Files to Modify**:
- `src/routes/buy-box-alerts/product/[asin]/+page.server.ts`
- `src/routes/buy-box-alerts/product/[asin]/+page.svelte`
- `src/routes/api/sales/[asin]/summary/+server.ts`

**Acceptance Criteria**:
- [x] Revenue displays with currency formatting
- [x] Unit sales displays with thousands separator
- [x] Trend indicators show week-over-week change
- [x] Graceful fallback if no data available
- [x] Tooltip shows data freshness

---

### **PHASE 4: Reviews & Ratings**
**Timeline**: 5-7 days  
**Goal**: Display product ratings and review metrics

#### Task 4.1: Product Reviews API Integration
**Status**: ⚪ Not Started  
**Effort**: 6 hours  
**Challenge**: ⚠️ Amazon SP-API does NOT provide review data

**Available Options**:

**Option A: Amazon Product Advertising API (PA-API)**
- ✅ Provides: Review count, average rating, rating breakdown
- ❌ Requires: Separate PA-API credentials (different from SP-API)
- ❌ Requires: Active Associates account with sales quota
- 💰 Cost: Free if sales quota met, otherwise paid

**Option B: Amazon Catalog API (Limited)**
- ✅ Provides: Review count only
- ❌ Does NOT provide: Average rating, rating distribution
- ✅ Already have access: Part of SP-API

**Option C: Scraping (NOT Recommended)**
- ❌ Violates Amazon Terms of Service
- ❌ Unreliable and can get blocked
- ❌ Legal risks

**Option D: Manual Entry**
- ✅ User can manually input current rating
- ❌ Not automated
- ⚠️ Can become stale quickly

**Recommended Implementation: Hybrid Approach**

```typescript
// Priority order:
1. Try PA-API if credentials available
2. Fall back to Catalog API (count only)
3. Allow manual override
4. Cache for 24 hours
```

**If Using PA-API**:
```typescript
// src/lib/amazon/pa-api-client.ts
import paapi from 'paapi5-nodejs-sdk';

const api = paapi.GetItems.request({
  ItemIds: [asin],
  Resources: [
    'CustomerReviews.Count',
    'CustomerReviews.StarRating'
  ]
});

Response: {
  averageRating: 4.5,
  totalReviews: 1430,
  ratingBreakdown: {
    5: 860,  // 60%
    4: 315,  // 22%
    3: 143,  // 10%
    2: 72,   // 5%
    1: 40    // 3%
  }
}
```

**Database Schema**:
```sql
CREATE TABLE product_reviews (
  id SERIAL PRIMARY KEY,
  asin VARCHAR(10) NOT NULL UNIQUE,
  average_rating DECIMAL(2,1), -- 4.5
  total_reviews INTEGER,
  rating_5_star INTEGER,
  rating_4_star INTEGER,
  rating_3_star INTEGER,
  rating_2_star INTEGER,
  rating_1_star INTEGER,
  data_source VARCHAR(20), -- 'pa-api', 'catalog', 'manual'
  last_updated TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (asin) REFERENCES current_state(asin)
);

CREATE INDEX idx_reviews_asin ON product_reviews(asin);
CREATE INDEX idx_reviews_updated ON product_reviews(last_updated);
```

**Files to Create**:
- `src/lib/amazon/pa-api-client.ts` (if PA-API available)
- `src/routes/api/reviews/[asin]/+server.ts`
- `migrations/add-product-reviews-table.sql`

**Acceptance Criteria**:
- [x] Gets review data from available source
- [x] Caches data for 24 hours
- [x] Displays rating with star visualization
- [x] Shows review count
- [x] Handles missing data gracefully

---

#### Task 4.2: Review Trends & Analysis
**Status**: ⚪ Not Started  
**Effort**: 4 hours  
**Dependencies**: Task 4.1 complete

**Features to Add**:
1. **Review Velocity**: Reviews per month trend
2. **Rating Trend**: Is rating improving or declining?
3. **Competitor Comparison**: Your rating vs competitors

**Implementation**:
```typescript
// Track historical review counts
CREATE TABLE review_history (
  id SERIAL PRIMARY KEY,
  asin VARCHAR(10) NOT NULL,
  review_count INTEGER,
  average_rating DECIMAL(2,1),
  recorded_at TIMESTAMP DEFAULT NOW()
);

// Daily snapshot allows trend calculation
INSERT INTO review_history (asin, review_count, average_rating)
SELECT asin, total_reviews, average_rating
FROM product_reviews;
```

**Metrics to Display**:
```
Current Rating: 4.5 ⭐ (1,430 reviews)
↑ +0.2 vs 30 days ago

Review Velocity: ~45 reviews/month
↑ Growing steadily

Competitor Average: 4.2 ⭐
✅ You're 7% higher
```

**Files to Create**:
- `src/lib/amazon/review-analytics.ts`
- `migrations/add-review-history-table.sql`

**Acceptance Criteria**:
- [x] Shows rating trend (up/down/stable)
- [x] Calculates review velocity
- [x] Compares to competitor average
- [x] Historical chart available

---

### **PHASE 5: FBA Fees & Profitability**
**Timeline**: 3-5 days  
**Goal**: Calculate accurate FBM/FBA fees and profit margins
**Status**: ✅ COMPLETE (October 13, 2025)

#### Task 5.1: FBA/FBM Fee Estimation API
**Status**: ✅ COMPLETE  
**Effort**: 6 hours  
**API**: `POST /products/fees/v0/items/{asin}/feesEstimate`
**Completed**: October 13, 2025

**How It Works**:
```typescript
// ✅ IMPLEMENTED in src/lib/amazon/fees-service.ts (225 lines)
Request {
  asin: string,                   // Product ASIN
  listPrice: number,              // Listing price
  isAmazonFulfilled: boolean,     // FBA (true) or FBM (false)
  shipping: number                // Shipping cost (optional)
}

Response {
  fbaFee: 0.00,                   // £0.00 for FBM, £4.73 for FBA
  referralFee: 7.77,              // 15% category fee
  variableClosingFee: 0.00,       // Usually £0 for most categories
  totalFees: 7.77,                // Sum of all fees
  estimatedProceeds: 44.03        // What you receive (£51.80 - £7.77)
}
```

**✅ FBM Configuration Implemented**:
- User is FBM (Fulfilled by Merchant) seller
- No FBA fees charged (£0.00)
- Only referral fee applies (15% = £7.77 at £51.80)
- Saves £4.73 per unit vs FBA

**Test Results**:
```
✅ ASIN B08BPCC8WD tested at £51.80
FBM Mode:
  ✅ FBA Fee: £0.00 (correct for FBM)
  ✅ Referral Fee: £7.77 (15%)
  ✅ Total Fees: £7.77
  ✅ You Receive: £44.03

FBA Comparison:
  FBA Fee: £4.73
  Referral Fee: £7.77
  Total Fees: £12.50
  You Receive: £39.30
  
💡 FBM saves £4.73 per unit!
```

**Database Schema**:
```sql
-- ⚠️ NOT YET IMPLEMENTED - Currently fetching fresh data each time
-- TODO: Implement caching for fee estimates
CREATE TABLE fba_fee_estimates (
  id SERIAL PRIMARY KEY,
  asin VARCHAR(10) NOT NULL,
  listing_price DECIMAL(10,2),
  is_amazon_fulfilled BOOLEAN DEFAULT false,
  fba_fee DECIMAL(10,2),
  referral_fee DECIMAL(10,2),
  variable_closing_fee DECIMAL(10,2),
  total_fees DECIMAL(10,2),
  estimated_proceeds DECIMAL(10,2),
  marketplace_id VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(asin, listing_price, is_amazon_fulfilled)
);

CREATE INDEX idx_fba_asin ON fba_fee_estimates(asin);
```

**Caching Strategy**:
- ⚠️ TODO: Cache fees for 24 hours at each price point
- ⚠️ TODO: Recalculate when price changes
- ⚠️ TODO: Background job: Update weekly for all monitored ASINs

**Files to Create**:
- ✅ `src/lib/amazon/fees-service.ts` - COMPLETE
- ⚠️ `migrations/add-fba-fee-estimates-table.sql` - TODO

**Acceptance Criteria**:
- ✅ Successfully fetches FBM/FBA fees for any ASIN
- ✅ Breaks down fee components (FBA, referral, closing)
- ⚠️ Caches results to avoid redundant calls - TODO
- ✅ Displays on product page with fulfillment type indicator
- ✅ UI conditionally shows/hides FBA fee based on fulfillment method
  
  -- Fee Breakdown
  total_fees DECIMAL(10,2),
  referral_fee DECIMAL(10,2),
  fba_fee DECIMAL(10,2),
  variable_closing_fee DECIMAL(10,2),
  
  -- Profitability
  cogs DECIMAL(10,2), -- Cost of goods (if available)
  estimated_profit DECIMAL(10,2),
  profit_margin_percent DECIMAL(5,2),
  
  -- Metadata
  marketplace_id VARCHAR(20),
  calculated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(asin, listing_price)
);

CREATE INDEX idx_fba_asin ON fba_fee_estimates(asin);
```

**Caching Strategy**:
- Cache fees for 24 hours at each price point
- Recalculate when price changes
- Background job: Update weekly for all monitored ASINs

**Files to Create**:
- `src/lib/amazon/fees-service.ts`
- `src/routes/api/amazon/fees/[asin]/+server.ts`
- `migrations/add-fba-fee-estimates-table.sql`

**Acceptance Criteria**:
- [x] Successfully fetches FBA fees for any SKU
- [x] Breaks down fee components
- [x] Caches results to avoid redundant calls
- [x] Handles multiple SKUs per ASIN
- [x] Displays on product page

---

#### Task 5.2: Profit Calculator Enhancement
**Status**: ⚪ Not Started  
**Effort**: 4 hours  
**Dependencies**: Task 5.1 complete

**Enhanced Profit Display**:
```
💰 Profitability Analysis

Current Price: £25.99
- FBA Fee: £4.60
- Referral Fee (15%): £3.90
- VAT (20%): £5.20
= Net Revenue: £12.29

Your COGS: £8.00 (editable)
= Gross Profit: £4.29
= Profit Margin: 17%

At Buy Box Price (£24.99):
= Gross Profit: £3.79
= Profit Margin: 15%
✅ Still profitable!

Break-even Price: £19.50
```

**Interactive Calculator**:
```svelte
<input 
  type="number" 
  bind:value={cogs}
  on:change={recalculateProfit}
  placeholder="Enter your cost"
/>

{#if cogs}
  <div class="profit-summary">
    <div class="profit {profit >= 0 ? 'positive' : 'negative'}">
      Profit: {formatCurrency(profit)}
    </div>
    <div class="margin">
      Margin: {marginPercent}%
    </div>
  </div>
{/if}
```

**Files to Modify**:
- `src/routes/buy-box-alerts/product/[asin]/+page.svelte`
- `src/lib/utils/profit-calculator.ts`

**Acceptance Criteria**:
- [x] Shows complete fee breakdown
- [x] Allows COGS input
- [x] Calculates profit at multiple price points
- [x] Shows break-even analysis
- [x] Saves COGS to user preferences

---

### **PHASE 6: BSR & Category Tracking**
**Timeline**: 4-6 days  
**Goal**: Track Best Sellers Rank over time

#### Task 6.1: BSR Data from Catalog API
**Status**: ⚪ Not Started  
**Effort**: 5 hours  
**API**: Already in Catalog API response

**Data Available**:
```typescript
// In Catalog API response
salesRanks: [
  {
    title: "Cell Phones & Accessories",
    rank: 145,
    displayGroupRank: {
      rank: 12,
      title: "Portable Power Banks"
    }
  }
]
```

**Database Schema**:
```sql
CREATE TABLE bsr_history (
  id SERIAL PRIMARY KEY,
  asin VARCHAR(10) NOT NULL,
  category VARCHAR(255),
  category_rank INTEGER,
  subcategory VARCHAR(255),
  subcategory_rank INTEGER,
  recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bsr_asin_date ON bsr_history(asin, recorded_at DESC);

-- For efficient range queries
CREATE INDEX idx_bsr_asin_recorded ON bsr_history(asin, recorded_at);
```

**Collection Strategy**:
- **Every 6 hours**: Fetch BSR from Catalog API
- Store historical snapshots
- Calculate trend (improving/declining)

**Files to Create**:
- `src/lib/amazon/bsr-tracker.ts`
- `src/routes/api/bsr/[asin]/history/+server.ts`
- `migrations/add-bsr-history-table.sql`

**Acceptance Criteria**:
- [x] BSR collected every 6 hours
- [x] Historical data stored efficiently
- [x] Can query 30-day BSR trend
- [x] Handles category changes

---

#### Task 6.2: BSR Chart on Product Page
**Status**: ⚪ Not Started  
**Effort**: 4 hours  
**Dependencies**: Task 6.1 complete

**Chart Features**:
- Line chart showing BSR over time
- Y-axis inverted (lower rank = better = higher on chart)
- Shows both main category and subcategory
- Highlights significant rank changes

**Implementation**:
```svelte
<!-- Add BSR chart to price chart -->
{#if activeTab === 'bsr'}
  <canvas bind:this={bsrChartCanvas}></canvas>
{/if}

// Chart.js config for BSR
{
  scales: {
    y: {
      reverse: true,  // Lower rank at top
      title: { text: 'Best Sellers Rank' }
    }
  }
}
```

**Metrics to Display**:
```
Current BSR: #145 in Cell Phones
↑ Improved 23 spots in 7 days

Subcategory: #12 in Portable Power Banks
↓ Dropped 3 spots

Best Rank (30d): #98
Worst Rank (30d): #267
```

**Files to Modify**:
- `src/routes/buy-box-alerts/product/[asin]/+page.svelte`
- Add new tab for BSR tracking

**Acceptance Criteria**:
- [x] BSR chart displays correctly
- [x] Trend indicators show improvement/decline
- [x] Can toggle between main/subcategory
- [x] Historical best/worst shown

---

### **PHASE 7: Enhanced Analytics & Charts**
**Timeline**: 5-7 days  
**Goal**: Add sales charts and advanced analytics

#### Task 7.1: Sales Tab Implementation
**Status**: ⚪ Not Started  
**Effort**: 6 hours  
**Dependencies**: Phase 3 complete

**Sales Chart Features**:
1. **Revenue Trend**: Daily revenue line chart
2. **Units Sold**: Daily units bar chart
3. **Conversion Rate**: Session-to-order conversion
4. **Traffic**: Sessions + page views

**Chart Implementation**:
```svelte
{#if activeTab === 'sales'}
  <canvas bind:this={salesChartCanvas}></canvas>
{/if}

// Multi-axis chart
datasets: [
  {
    label: 'Revenue',
    data: salesHistory.map(d => ({ x: d.date, y: d.revenue })),
    yAxisID: 'yRevenue',
    type: 'line'
  },
  {
    label: 'Units',
    data: salesHistory.map(d => ({ x: d.date, y: d.units })),
    yAxisID: 'yUnits',
    type: 'bar'
  }
]
```

**Metrics Summary**:
```
30-Day Performance:

Total Revenue: £23,556
↑ +12.5% vs previous 30 days

Units Sold: 45,875
↑ +8.2% vs previous 30 days

Avg Order Value: £51.38
↑ +3.8%

Conversion Rate: 12.5%
↓ -0.8% (needs attention)
```

**Files to Modify**:
- `src/routes/buy-box-alerts/product/[asin]/+page.svelte`
- Enable "Sales" tab
- Add sales chart rendering logic

**Acceptance Criteria**:
- [x] Sales tab is functional
- [x] Chart shows revenue + units
- [x] Metrics summary displays correctly
- [x] Can compare time periods

---

#### Task 7.2: Reviews Tab Implementation
**Status**: ⚪ Not Started  
**Effort**: 4 hours  
**Dependencies**: Phase 4 complete

**Reviews Tab Features**:
1. **Rating Distribution**: Bar chart of 1-5 star reviews
2. **Rating Trend**: Line chart over time
3. **Review Velocity**: Reviews per month
4. **Competitor Comparison**: Side-by-side ratings

**Rating Distribution Chart**:
```svelte
<!-- Horizontal bar chart -->
<div class="rating-bars">
  {#each [5,4,3,2,1] as stars}
    <div class="rating-row">
      <span>{stars} ⭐</span>
      <div class="bar-container">
        <div 
          class="bar" 
          style="width: {(reviews[stars] / totalReviews * 100)}%"
        ></div>
      </div>
      <span>{reviews[stars]} ({percentage}%)</span>
    </div>
  {/each}
</div>
```

**Files to Modify**:
- `src/routes/buy-box-alerts/product/[asin]/+page.svelte`
- Enable "Reviews" tab
- Add rating distribution visualization

**Acceptance Criteria**:
- [x] Reviews tab is functional
- [x] Rating distribution displays clearly
- [x] Rating trend chart works
- [x] Competitor comparison shown

---

### **PHASE 8: Automation & Monitoring**
**Timeline**: 4-5 days  
**Goal**: Automate data collection and add monitoring

#### Task 8.1: Background Job Scheduler
**Status**: ⚪ Not Started  
**Effort**: 6 hours  

**Jobs to Schedule**:

```typescript
// 1. Daily Sales Report (2 AM UTC)
cron: '0 2 * * *'
task: Request previous day's sales report
duration: ~20 min
priority: HIGH

// 2. Catalog Refresh (Weekly, Sunday 3 AM)
cron: '0 3 * * 0'
task: Update catalog data for all monitored ASINs
duration: ~2 hours
priority: MEDIUM

// 3. BSR Tracking (Every 6 hours)
cron: '0 */6 * * *'
task: Fetch current BSR for all ASINs
duration: ~30 min
priority: MEDIUM

// 4. Fee Recalculation (Daily, 4 AM)
cron: '0 4 * * *'
task: Update FBA fees for all ASINs
duration: ~45 min
priority: LOW

// 5. Review Update (Daily, 5 AM)
cron: '0 5 * * *'
task: Fetch latest review counts/ratings
duration: ~20 min
priority: LOW
```

**Implementation**:
```typescript
// cron-jobs/scheduler.ts
import cron from 'node-cron';

cron.schedule('0 2 * * *', async () => {
  await requestDailySalesReport();
});

cron.schedule('0 */6 * * *', async () => {
  await updateBSRData();
});

// ... etc
```

**Monitoring Dashboard**:
```
📊 Job Status Dashboard

Job                  | Last Run          | Status    | Next Run
---------------------|-------------------|-----------|------------------
Daily Sales Report   | 2 hours ago      | ✅ Success | in 22 hours
Catalog Refresh      | 2 days ago       | ✅ Success | in 5 days
BSR Tracking         | 3 hours ago      | ✅ Success | in 3 hours
Fee Recalculation    | 1 day ago        | ⚠️ Partial | in 23 hours
Review Update        | 1 day ago        | ✅ Success | in 23 hours
```

**Files to Create**:
- `cron-jobs/scheduler.ts`
- `src/routes/admin/jobs/+page.svelte` (monitoring UI)
- `src/lib/jobs/job-manager.ts`

**Acceptance Criteria**:
- [x] All jobs run on schedule
- [x] Failures are logged and retried
- [x] Can view job status in admin panel
- [x] Email alerts on critical failures
- [x] Jobs respect API rate limits

---

#### Task 8.2: Error Handling & Retry Logic
**Status**: ⚪ Not Started  
**Effort**: 4 hours  

**Retry Strategies**:

```typescript
// Exponential backoff for API failures
async function retryWithBackoff(
  fn: () => Promise<any>,
  maxRetries = 3,
  baseDelay = 1000
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = baseDelay * Math.pow(2, i);
      await sleep(delay);
    }
  }
}
```

**Error Categories**:
1. **Transient** (retry immediately): Network errors, timeouts
2. **Rate Limit** (retry after delay): 429 errors
3. **Auth** (refresh token): 401/403 errors
4. **Fatal** (don't retry): 400 bad request, 404 not found

**Files to Create**:
- `src/lib/utils/retry-logic.ts`
- `src/lib/amazon/error-handler.ts`

**Acceptance Criteria**:
- [x] Transient errors retry 3 times
- [x] Rate limits respected with backoff
- [x] Auth errors trigger token refresh
- [x] Fatal errors logged but not retried
- [x] All errors tracked in database

---

### **PHASE 9: Performance & Optimization**
**Timeline**: 3-4 days  
**Goal**: Optimize page load times and database queries

#### Task 9.1: Database Query Optimization
**Status**: ⚪ Not Started  
**Effort**: 4 hours  

**Current Issues**:
- Loading 500+ historical notifications per page load
- No pagination on competitor table
- Recalculating analytics on every request

**Optimizations**:

```sql
-- 1. Materialized views for analytics
CREATE MATERIALIZED VIEW product_analytics AS
SELECT 
  asin,
  COUNT(*) as total_notifications,
  AVG(your_price) as avg_price,
  MIN(your_price) as min_price,
  MAX(your_price) as max_price,
  AVG(your_position) as avg_position,
  COUNT(CASE WHEN is_buybox_winner THEN 1 END) * 100.0 / COUNT(*) as buybox_win_rate
FROM processed_notifications
GROUP BY asin;

-- Refresh daily
REFRESH MATERIALIZED VIEW product_analytics;

-- 2. Indexes for common queries
CREATE INDEX idx_notifications_asin_date 
ON worker_notifications(asin, received_at DESC);

CREATE INDEX idx_sales_asin_recent 
ON amazon_sales_data(asin, report_date DESC) 
WHERE report_date >= CURRENT_DATE - INTERVAL '90 days';

-- 3. Partial index for recent data
CREATE INDEX idx_current_notifications 
ON worker_notifications(asin, received_at DESC)
WHERE received_at >= CURRENT_DATE - INTERVAL '30 days';
```

**Pagination Strategy**:
```typescript
// Limit initial load to 100 records
const history = await getNotificationHistory(asin, { limit: 100 });

// Load more on demand
button onclick="loadMoreHistory()"
```

**Acceptance Criteria**:
- [x] Page loads in <2 seconds
- [x] Initial query returns ≤100 records
- [x] Analytics pre-calculated
- [x] Indexes improve query time by 50%+

---

#### Task 9.2: Caching Strategy
**Status**: ⚪ Not Started  
**Effort**: 4 hours  

**What to Cache**:

```typescript
// 1. Catalog data (7 days)
cache.set(`catalog:${asin}`, data, { ttl: 7 * 24 * 60 * 60 });

// 2. Sales data (24 hours)
cache.set(`sales:${asin}:30d`, data, { ttl: 24 * 60 * 60 });

// 3. Review data (24 hours)
cache.set(`reviews:${asin}`, data, { ttl: 24 * 60 * 60 });

// 4. FBA fees (24 hours per price point)
cache.set(`fees:${asin}:${price}`, data, { ttl: 24 * 60 * 60 });

// 5. Listing health (24 hours)
cache.set(`health:${asin}`, data, { ttl: 24 * 60 * 60 });
```

**Cache Implementation**:
```typescript
// Option A: In-memory (node-cache)
import NodeCache from 'node-cache';
const cache = new NodeCache({ stdTTL: 3600 });

// Option B: Redis (for production)
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

// Option C: Database table
CREATE TABLE api_cache (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB,
  expires_at TIMESTAMP
);
```

**Cache Invalidation**:
```typescript
// Invalidate on:
1. Manual refresh button click
2. Price change detected
3. New notification received
4. TTL expires

// Implement cache-aside pattern
async function getCatalogData(asin) {
  const cached = await cache.get(`catalog:${asin}`);
  if (cached) return cached;
  
  const fresh = await fetchFromAPI(asin);
  await cache.set(`catalog:${asin}`, fresh, { ttl: 7 * 24 * 60 * 60 });
  return fresh;
}
```

**Acceptance Criteria**:
- [x] Cache reduces API calls by 80%
- [x] Stale data is updated automatically
- [x] Manual refresh works
- [x] Cache hit rate >70%

---

### **PHASE 10: Testing & Launch**
**Timeline**: 5-7 days  
**Goal**: Comprehensive testing and production deployment

#### Task 10.1: Integration Testing
**Status**: ⚪ Not Started  
**Effort**: 8 hours  

**Test Scenarios**:

```typescript
// 1. Happy path
test('Product page loads with all data', async () => {
  const page = await loadProductPage('B08X6PZFN2');
  expect(page.revenue30d).toBeGreaterThan(0);
  expect(page.currentRating).toBeDefined();
  expect(page.listingHealthScore).toBeGreaterThan(0);
  expect(page.competitors.length).toBeGreaterThan(0);
});

// 2. New ASIN (no historical data)
test('Handles new ASIN gracefully', async () => {
  const page = await loadProductPage('B0NEWPRODUCT');
  expect(page.history).toHaveLength(0);
  expect(page.revenue30d).toBeNull();
  // Should show onboarding message
});

// 3. API failures
test('Gracefully handles API errors', async () => {
  mockAPIFailure('catalog');
  const page = await loadProductPage('B08X6PZFN2');
  // Should show cached data or placeholder
  expect(page.error).toBeUndefined();
});

// 4. Rate limiting
test('Respects API rate limits', async () => {
  // Make 10 rapid requests
  const promises = Array(10).fill(null).map(() => 
    fetchCatalogData('B08X6PZFN2')
  );
  const results = await Promise.all(promises);
  // All should succeed, none should get 429
  expect(results.every(r => r.status === 200)).toBe(true);
});

// 5. Data freshness
test('Shows data age indicators', async () => {
  const page = await loadProductPage('B08X6PZFN2');
  expect(page.salesDataAge).toBe('Updated 2 hours ago');
  expect(page.reviewDataAge).toBe('Updated 1 day ago');
});
```

**Files to Create**:
- `tests/integration/product-page.test.ts`
- `tests/integration/api-endpoints.test.ts`
- `tests/integration/cron-jobs.test.ts`

**Acceptance Criteria**:
- [x] All integration tests pass
- [x] Edge cases handled correctly
- [x] Error states display properly
- [x] Rate limits respected
- [x] Test coverage >80%

---

#### Task 10.2: Production Deployment Checklist
**Status**: ⚪ Not Started  
**Effort**: 4 hours  

**Pre-Launch Checklist**:

```
Environment Setup:
□ All API credentials in production .env
□ Database migrations applied
□ Indexes created on all tables
□ Cron jobs scheduled
□ Error logging configured (Sentry/LogRocket)
□ Performance monitoring enabled (New Relic/DataDog)

Data Verification:
□ Sales data importing correctly
□ Catalog data complete for all ASINs
□ Review data accurate
□ FBA fees calculating correctly
□ BSR tracking working

Performance:
□ Page loads <2 seconds
□ API responses <500ms
□ Database queries optimized
□ Caching working correctly

Security:
□ API keys not exposed in frontend
□ Rate limiting on API endpoints
□ SQL injection prevention verified
□ CORS configured correctly

User Experience:
□ Loading states for all async data
□ Error messages user-friendly
□ Responsive design works on mobile
□ Tooltips explain metrics
□ Charts load correctly

Monitoring:
□ Uptime monitoring configured
□ Error alerts set up
□ Daily reports automated
□ Job failure alerts working
```

---

#### Task 10.3: Documentation
**Status**: ⚪ Not Started  
**Effort**: 4 hours  

**Documentation to Create**:

1. **User Guide**: How to use the product detail page
2. **API Documentation**: Internal API reference
3. **Admin Guide**: Managing cron jobs and monitoring
4. **Troubleshooting**: Common issues and solutions
5. **Architecture Diagram**: System overview

**Files to Create**:
- `docs/USER_GUIDE_PRODUCT_PAGE.md`
- `docs/API_REFERENCE.md`
- `docs/ADMIN_GUIDE.md`
- `docs/TROUBLESHOOTING.md`
- `docs/ARCHITECTURE.md`

---

## 📊 Progress Tracking

### Overall Completion: 0% (0/51 tasks)

| Phase | Tasks | Completed | Status |
|-------|-------|-----------|--------|
| Phase 1: Foundation | 3 | 0 | ⚪ Not Started |
| Phase 2: Product Catalog | 3 | 0 | ⚪ Not Started |
| Phase 3: Sales & Traffic | 4 | 0 | ⚪ Not Started |
| Phase 4: Reviews & Ratings | 2 | 0 | ⚪ Not Started |
| Phase 5: FBA Fees | 2 | 0 | ⚪ Not Started |
| Phase 6: BSR Tracking | 2 | 0 | ⚪ Not Started |
| Phase 7: Enhanced Analytics | 2 | 0 | ⚪ Not Started |
| Phase 8: Automation | 2 | 0 | ⚪ Not Started |
| Phase 9: Optimization | 2 | 0 | ⚪ Not Started |
| Phase 10: Testing & Launch | 3 | 0 | ⚪ Not Started |

---

## 🎯 Success Metrics

**By Completion, We Should Have**:

- ✅ 100% real data (no mocks)
- ✅ <2 second page load times
- ✅ 99.9% uptime for data collection
- ✅ Daily automated data refresh
- ✅ <1% API error rate
- ✅ Comprehensive monitoring & alerts
- ✅ Full test coverage

---

## 🚀 Quick Start Guide

**Week 1**: Phase 1 (Foundation)
- Get existing data displaying correctly
- Set up SP-API client library
- Fix Prime/FBA counts

**Week 2**: Phase 2 (Catalog)
- Integrate Catalog API
- Calculate listing health score
- Extract keywords

**Week 3**: Phase 3 (Sales Reports)
- Set up Reports API
- Build data collection pipeline
- Display revenue/units

**Week 4**: Phases 4-5 (Reviews & Fees)
- Add review data
- Implement FBA fee calculator
- Enhance profit analysis

**Week 5**: Phases 6-7 (BSR & Charts)
- BSR tracking
- Enable all chart tabs
- Advanced analytics

**Week 6**: Phases 8-10 (Polish & Launch)
- Automation setup
- Performance optimization
- Testing & deployment

---

## 📞 Support & Questions

**Technical Issues**: Check `docs/TROUBLESHOOTING.md`  
**API Questions**: See `AMAZON_SP_API_QUICK_REFERENCE.md`  
**Feature Requests**: Create GitHub issue  

---

**Last Updated**: 13 October 2025  
**Next Review**: After Phase 1 completion
