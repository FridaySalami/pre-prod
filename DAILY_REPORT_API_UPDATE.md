# Daily Report API Update - Role Breakdown Metrics

## Overview
The daily report API has been updated to include the new role breakdown metrics from the updated dashboard. This provides comprehensive labor tracking data for external integrations and reporting.

## New Fields Added to Daily Report

### Fulfillment Operations Section
The `fulfillment` object now includes additional labor metrics:

```typescript
fulfillment: {
  shipmentsPacked: number;          // 1.1 - Auto-populated from Linnworks
  scheduledHours: number;           // 1.2 - Total scheduled hours
  totalHoursUsed: number;           // 1.3 - Total hours used (was actualHoursWorked)
  managementHoursUsed: number;      // 1.3.1 - Management role hours
  packingHoursUsed: number;         // 1.3.2 - Packing/Associate hours  
  pickingHoursUsed: number;         // 1.3.3 - Picking role hours
  laborEfficiency: number;          // 1.4 - Updated calculation
  laborUtilization: number;         // 1.5 - Utilization percentage
}
```

## API Response Example

```json
{
  "date": "2025-06-17",
  "formattedDate": "Monday, 17 June 2025",
  "fulfillment": {
    "shipmentsPacked": 528,
    "scheduledHours": 42.5,
    "totalHoursUsed": 29,
    "managementHoursUsed": 13,
    "packingHoursUsed": 14,
    "pickingHoursUsed": 2,
    "laborEfficiency": 33.0,
    "laborUtilization": 68.24
  },
  "sales": { ... },
  "orders": { ... },
  "metrics": { ... },
  "status": { ... }
}
```

## Key Changes Made

### 1. **Interface Updates**
- Added new role breakdown fields to `DailyReportData` interface
- Updated fulfillment section to include all labor metrics

### 2. **Data Population**
- Updated to use new column names from `daily_metric_review` table:
  - `shipments_packed` (was calculated from hours × efficiency)
  - `scheduled_hours`
  - `management_hours_used`
  - `packing_hours_used` 
  - `picking_hours_used`
  - `labor_utilization_percent` (was `labor_utilization`)

### 3. **Fallback Handling**
- Enhanced fallback data to include default values for new fields
- Role breakdown metrics default to 0 when comprehensive data unavailable

## Usage

### Make.com Integration
The API endpoint remains the same:
```
GET /api/daily-report?date=2025-06-17
```

The response now includes detailed labor breakdown metrics that can be used for:
- **Role-based productivity analysis**
- **Labor cost allocation**
- **Efficiency reporting by function**
- **Management vs. operational hours tracking**

### Labor Efficiency Calculation
The API now uses the updated formula that matches the dashboard:
- **New:** `Shipments ÷ (Packing Hours + Picking Hours)`
- **Old:** `Shipments ÷ Total Hours`
- **Fallback:** Uses total hours when role breakdown data is unavailable

This provides a more accurate measure of direct fulfillment efficiency by excluding management hours from the calculation.

## Files Updated
- ✅ `src/routes/api/daily-report/+server.ts` - API endpoint with new fields
- ✅ Interface and response structure expanded
- ✅ Backward compatibility maintained for existing fields

## Benefits
1. **Complete Labor Picture**: Full breakdown of how labor hours are allocated
2. **Enhanced Analytics**: Role-specific performance tracking
3. **Better Reporting**: More granular data for business intelligence
4. **Operational Insights**: Understand efficiency at the role level

The daily report now provides a comprehensive operational snapshot including all the enhanced labor tracking metrics from the updated dashboard.
