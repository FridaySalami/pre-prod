# Shipments Packed API Data Fix

## Issue
The dashboard was correctly displaying API-pulled total orders data (528) but when uploading to the `daily_metric_review` table, it was still using the old manual "1.1 Shipments Packed" value (574) instead of the API data.

This caused inconsistency between:
- **Dashboard display**: Correct API total orders (528)
- **Uploaded data**: Manual shipments packed (574)
- **API response**: Wrong value from database (574)

## Solution
Updated `dailyMetricReviewService.ts` to use the API total orders data when saving `shipments_packed` to the database.

### Changes Made

#### 1. Updated Upload Logic
**File**: `src/lib/dailyMetricReviewService.ts`

**Before**:
```typescript
shipments_packed: shipmentsPackedIdx >= 0 ? (metrics[shipmentsPackedIdx].values[dayIndex] || 0) : 0,
```

**After**:
```typescript
shipments_packed: totalOrdersIdx >= 0 ? (metrics[totalOrdersIdx].values[dayIndex] || 0) : 0, // CHANGED: Use API total orders instead of manual shipments
```

#### 2. Updated Dashboard Calculations
**File**: `src/lib/ShipmentChart.svelte`

Updated all labor efficiency and quality metric calculations to use API total orders data (`2.1 Linnworks Total Orders`) instead of manual shipments packed (`1.1 Shipments Packed`):

- Labor Efficiency calculation (multiple locations)
- Packing Errors DPMO calculation 
- Order Accuracy percentage calculation
- Week-over-week comparison calculations
- Previous week totals calculations

#### 3. Updated Documentation
**Before**:
```typescript
shipments_packed: number; // 1.1 (now auto-populated from Linnworks orders)
```

**After**:
```typescript
shipments_packed: number; // 1.1 (now uses API total orders data, not manual entry)
```

## Impact

### Before Fix
- **Dashboard Display**: Shows 528 (correct API data)
- **Dashboard Calculations**: Mixed - some used 574 (manual), some used 528 (API)
- **Database Upload**: Stores 574 (manual entry)
- **API Response**: Returns 574 (from database)
- **Labor Efficiency**: 18.52 (calculated with wrong 574 value)

### After Fix
- **Dashboard Display**: Shows 528 (correct API data)
- **Dashboard Calculations**: All use 528 (correct API data consistently)
- **Database Upload**: Stores 528 (correct API data)
- **API Response**: Returns 528 (correct from database)
- **Labor Efficiency**: Will be calculated correctly using 528 for all metrics

### Key Improvements
- **Consistency**: All calculations now use the same API source data
- **Accuracy**: Labor efficiency, DPMO, and order accuracy metrics now use correct order counts
- **Data Integrity**: Database stores accurate API-sourced data instead of manual entries

## Testing
1. Upload metrics from dashboard with API data loaded
2. Verify `daily_metric_review` table stores correct API total orders value
3. Confirm daily report API returns correct shipmentsPacked value
4. Validate labor efficiency calculations use correct order count

## Files Modified
- `/src/lib/dailyMetricReviewService.ts`

## Related Changes
This fix ensures consistency with the previous updates that changed labor efficiency calculations to use role-based hour breakdowns and API-sourced order data.
