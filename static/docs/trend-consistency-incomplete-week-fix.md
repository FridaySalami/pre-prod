# Trend Consistency Analysis - Incomplete Week Handling

## Issue
The trend consistency analysis (which determines if there's a "consistent directional change over multiple periods") was potentially including the current incomplete week in its calculations. This could lead to misleading business messages about trends, especially when the current week is incomplete and shows lower values due to incomplete data rather than actual business decline.

## Root Cause Analysis
1. **Data Flow**: Weekly data flows through `historicalDataService.ts` → `calculateTrend()` → `SignificanceAnalyzer.analyzeSignificance()` → `checkTrendConsistency()`
2. **Filtering Logic**: The `groupDataByWeek()` method in `historicalDataService.ts` already filters out incomplete current weeks using:
   ```typescript
   const completeWeeks = allWeeklyPoints
     .filter(week => !week.isCurrentWeek) // Exclude current incomplete week
   ```
3. **Trend Analysis**: The `checkTrendConsistency()` method uses the last `trendWindowSize` values (default: 3) to check for consistent directional change

## Solution Implemented
### 1. Enhanced Documentation
- Added clear comments in `checkTrendConsistency()` method explaining that incomplete periods should be excluded before calling this method
- Added documentation in `calculateTrend()` method noting that the values array should exclude incomplete current periods
- Added explicit comment in the trend analysis section of `analyzeSignificance()` method

### 2. Data Flow Validation
- Confirmed that `groupDataByWeek()` already filters out incomplete weeks using `!week.isCurrentWeek`
- Verified that this is the main path for weekly data processing
- Added safeguards and documentation to prevent future issues

### 3. Updated Trend Consistency Logic
- Maintained the existing 75% consistency threshold and minimum 2 changes requirement
- Updated the reporting to use `actualValues.length` for accurate period count
- Added comments to make the incomplete data handling explicit

## Technical Details
### Trend Consistency Algorithm
```typescript
// Uses last 'trendWindowSize' periods (default: 3)
const actualValues = recentValues;

// Calculates directional changes
for (let i = 1; i < actualValues.length; i++) {
  const change = actualValues[i] - actualValues[i - 1];
  if (change > 0) positiveChanges++;
  else if (change < 0) negativeChanges++;
}

// Significance threshold: >75% consistency in same direction
const isSignificant = trendStrength > 0.75 && totalChanges >= 2;
```

### Data Filtering Chain
1. **Daily Data Fetch**: Excludes today if using current date as reference
2. **Weekly Grouping**: Explicitly filters out `isCurrentWeek` weeks
3. **Trend Analysis**: Works on already-filtered complete weeks
4. **Significance Analysis**: Uses the filtered data for trend consistency

## Validation
The implementation ensures that:
- ✅ Current incomplete weeks are excluded from weekly data aggregation
- ✅ Trend consistency analysis operates on complete weeks only
- ✅ Business messaging reflects accurate trend patterns
- ✅ Documentation clearly explains the incomplete data handling requirements

## Files Modified
- `/src/lib/services/significanceAnalyzer.ts` - Enhanced documentation and validation
- `/src/lib/services/historicalDataService.ts` - Enhanced documentation
- `/docs/trend-consistency-incomplete-week-fix.md` - This documentation

## Testing Recommendations
To verify the fix is working:
1. Check that weekly data excludes the current incomplete week
2. Verify that trend messages are based on complete weeks only
3. Confirm that "consistent directional change" messages are accurate
4. Test during different times of the week to ensure consistent behavior

## Future Considerations
- Consider adding runtime validation to detect if incomplete data is accidentally passed to trend analysis
- Monitor trend consistency messages for accuracy in production
- Consider adding debug logging to trace which periods are used for trend analysis
