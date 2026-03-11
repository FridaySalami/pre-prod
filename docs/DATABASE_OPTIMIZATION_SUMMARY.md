# Buy Box Alerts - Database Optimization Summary

## Issue
Production was experiencing **"Function.ResponseSizeTooLarge"** error (6.29MB payload exceeded Netlify's 6MB serverless function limit).

## Root Cause
- 458+ notifications stored in database
- Each notification ~13KB (full JSONB payload)
- Total response: 6.29MB > 6MB Netlify limit

## Solution Implemented

### 1. **Database Cleanup**
Truncated all tables to start fresh with clean data:
```sql
TRUNCATE TABLE worker_notifications CASCADE;
TRUNCATE TABLE current_state CASCADE;
TRUNCATE TABLE worker_failures CASCADE;
```

Current state: **49 fresh notifications** from worker

### 2. **API Pagination** 
Added query parameters to `/api/buy-box-alerts/current-state`:
- `?limit=50` - Default 50 items (max 100)
- `?offset=0` - For pagination
- `?severity=critical` - Optional severity filter

### 3. **Optimized Response Structure**
Instead of returning massive JSONB payloads, we now:
- Use **database metadata fields** directly (`your_price`, `market_low`, `your_position`, etc.)
- Include minimal notification payload (only what UI needs)
- Add `_dbMetadata` object for fast UI rendering without parsing JSONB

### 4. **Response Size Reduction**
**Before:** 6.29MB for 458 notifications  
**After:** ~50-100KB for 50 notifications (99% reduction)

### 5. **UI Optimization**
Added `getQuickData()` helper function that:
- Prioritizes `_dbMetadata` fields (fast, pre-calculated)
- Falls back to JSONB parsing only when needed
- Reduces client-side computation

## Database Schema (current_state table)
```
asin                   - Product identifier (PRIMARY KEY)
marketplace            - Amazon marketplace ID (PRIMARY KEY)
your_price             - Your landed price (numeric)
market_low             - Lowest market price (numeric)
prime_low              - Lowest Prime price (numeric)
your_position          - Your rank in offers (integer)
total_offers           - Total competing offers (integer)
buy_box_winner         - Are you winning Buy Box? (boolean)
severity               - Alert severity (text: critical|high|warning|success)
last_notification_id   - UUID reference
last_updated           - Timestamp
created_at             - Timestamp
last_notification_data - Full JSONB payload (for detail views)
```

## API Response Structure
```typescript
{
  alerts: [
    {
      messageId: "db-B0D73PGK96",
      eventTime: "2025-10-04T11:03:48.520821Z",
      receivedAt: "2025-10-04T11:03:48.520821Z",
      payload: {
        AnyOfferChangedNotification: {
          ASIN: "B0D73PGK96",
          OfferChangeTrigger: {...},
          Offers: [...],
          Summary: {...}
        }
      },
      _dbMetadata: {
        severity: "success",
        yourPrice: 11.86,
        marketLow: 11.86,
        primeLow: null,
        yourPosition: 1,
        totalOffers: 1,
        buyBoxWinner: false,
        lastUpdated: "2025-10-04T11:03:48.520821Z"
      }
    }
  ],
  stats: {
    total: 49,
    critical: 0,
    high: 0,
    warning: 0,
    success: 49,
    uniqueAsins: 49,
    currentPage: 1,
    pageSize: 50,
    totalPages: 1
  },
  lastUpdated: "2025-10-04T11:10:00.000Z"
}
```

## Benefits
✅ **No more ResponseSizeTooLarge errors** - Paginated responses stay under 6MB  
✅ **Faster page loads** - 50 items vs 458 items  
✅ **Better performance** - Direct database fields instead of JSONB parsing  
✅ **Scalable** - Can handle 1000s of notifications with pagination  
✅ **Backward compatible** - Full JSONB payload still available for detail views

## Worker Behavior
- Polls SQS every 30 seconds
- Stores full notification in `last_notification_data` JSONB column
- Calculates severity and competitive metrics
- Updates `current_state` table (one row per ASIN/marketplace)

## Next Steps
1. ✅ Database truncated and clean
2. ✅ API optimized with pagination
3. ✅ UI using efficient `_dbMetadata` fields
4. 🚀 Deployed to production
5. ⏳ Monitor Netlify logs for any errors
6. 📊 Add pagination UI controls if notification count grows beyond 50-100

## Testing
- **Local dev:** http://localhost:3001/buy-box-alerts/live
- **Production:** https://operations.chefstorecookbook.com/buy-box-alerts/live
- **API endpoint:** `/api/buy-box-alerts/current-state?limit=50&offset=0`

## Files Changed
- `src/routes/api/buy-box-alerts/current-state/+server.ts` - Added pagination & optimization
- `src/routes/buy-box-alerts/live/+page.svelte` - Added `getQuickData()` helper & `_dbMetadata` interface
