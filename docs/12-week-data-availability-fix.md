# 12-Week Data Availability Fix

## Problem
The weekly data charts were not displaying significance analysis because:
1. We request 12 weeks of data from the database
2. We filter out the current incomplete week 
3. This leaves only 11 weeks of data
4. Our 12-week minimum threshold was not met
5. No significance analysis was displayed

## Root Cause
The data fetching logic wasn't accounting for the fact that the current week would be filtered out, leading to one fewer week than requested.

## Solution
Implemented a multi-part fix to ensure we always have at least 12 complete weeks for analysis:

### 1. Data Fetching Logic (`historicalDataService.ts`)
- **Modified `fetchWeeklyData()`**: Now requests `count + 1` weeks to account for current week filtering
- **Updated `groupDataByWeek()`**: Properly handles the filtering and ensures exactly the requested number of complete weeks
- **Improved Logic**: Filters out current incomplete week and takes the actual requested number of complete weeks

### 2. Default Values Updated
- **Service Default**: Changed from 8 weeks to 12 weeks in `fetchWeeklyData()` 
- **UI Default**: Updated `weeklyConfig.weeksCount` from 8 to 12 in analytics page
- **Type Documentation**: Updated comments to reflect 12-week minimum requirement

### 3. Data Flow Fix
**Before:**
```
Request 12 weeks → Get 12 weeks → Filter current week → 11 weeks → Below threshold → No analysis
```

**After:**
```
Request 12 weeks → Fetch 13 weeks → Filter current week → 12 complete weeks → Meet threshold → Show analysis
```

## Changes Made

### `/src/lib/services/historicalDataService.ts`
```typescript
// Line 120: Updated default count
const { metric, count = 12, endDate } = request; // Default to 12 weeks for statistical significance

// Line 145: Fetch extra week to account for filtering  
const weeklyData = this.groupDataByWeek(data, metric, count + 1);

// Lines 175-260: Updated groupDataByWeek method
// - Better handling of current week filtering
// - Ensures exactly requested number of complete weeks returned
// - Proper slicing after filtering
```

### `/src/routes/analytics/monthly/+page.svelte`
```typescript
// Line 91: Updated default weeks count
weeksCount: 12, // Minimum for reliable statistical analysis
```

### `/src/lib/types/historicalData.ts`
```typescript
// Line 34: Updated type documentation
count: number; // Number of weeks (default 12, minimum 12 for statistical analysis)
```

## Testing Verification

### Expected Behavior Now:
1. **Default Load**: Analytics page loads with 12 weeks selected by default
2. **Data Availability**: Always get exactly 12 complete weeks (excluding current)
3. **Significance Analysis**: Shows enhanced significance display with proper statistical analysis
4. **Backward Compatibility**: Still works with any count ≥ 12, fetches count + 1 and returns count complete weeks

### Edge Cases Handled:
- **Insufficient Historical Data**: If database has < 13 weeks total, shows appropriate "insufficient data" message
- **Current Week Edge**: Properly excludes current incomplete week regardless of when user loads page
- **Weekend Loading**: Consistent behavior whether loaded on Monday vs Sunday

## UI Impact

### Statistics Cards
- **Before**: "Insufficient data" badge with countdown
- **After**: Enhanced significance display with urgency indicators and business insights

### Detailed Analysis Section  
- **Before**: Hidden due to insufficient data
- **After**: Full enhanced significance analysis with recommendations and technical details

### User Experience
- **Immediate Value**: Users see actionable business insights from day one
- **Statistical Confidence**: All displayed analyses meet the 12-week minimum for reliability
- **Progressive Enhancement**: Technical details available but not overwhelming

## Performance Impact
- **Minimal Overhead**: Only fetches one additional week of data
- **No Memory Impact**: Proper filtering ensures same final dataset size
- **Database Queries**: Slightly larger date range but same query structure

## Business Value
1. **Reliable Analysis**: All significance testing now meets statistical requirements
2. **Actionable Insights**: Users get business-friendly recommendations instead of "insufficient data"
3. **Consistent Experience**: Same analysis quality regardless of when page is loaded
4. **Statistical Rigor**: Maintains academic standards while improving usability

## Next Steps
1. **Monitor Performance**: Track query performance with larger date ranges
2. **User Feedback**: Collect feedback on 12-week default vs previous 8-week default
3. **Data Validation**: Ensure all historical data sources have sufficient depth
4. **Documentation**: Update user guides to reflect new minimum requirements

This fix ensures that the enhanced significance analysis is actually usable in production while maintaining statistical rigor and providing immediate business value to users.
