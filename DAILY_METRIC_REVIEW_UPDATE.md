# Daily Metric Review Table Update Instructions

## Overview
The dashboard has been updated with new role breakdown metrics and the shipments packed field is now auto-populated from Linnworks orders. This requires updating the Supabase `daily_metric_review` table.

## Step 1: Run the SQL Update Script
Execute the SQL file `update-daily-metric-review-table.sql` in your Supabase SQL editor to add the new columns:

- `shipments_packed` (numeric) - Auto-populated from Linnworks total orders
- `management_hours_used` (numeric) - Hours for management roles
- `packing_hours_used` (numeric) - Hours for packing/associate roles  
- `picking_hours_used` (numeric) - Hours for picking roles
- `scheduled_hours` (numeric) - Total scheduled hours
- `labor_utilization_percent` (numeric) - Labor utilization percentage

## Step 2: Verify the Upload Review Function
The TypeScript service has been updated to include all new metrics:

### New Fields Added to Export:
- **1.1 Shipments Packed** → `shipments_packed`
- **1.2 Scheduled Hours** → `scheduled_hours` 
- **1.3 Total Hours Used** → `actual_hours_worked` (kept same column name)
- **1.3.1 Management Hours Used** → `management_hours_used`
- **1.3.2 Packing Hours Used** → `packing_hours_used`
- **1.3.3 Picking Hours Used** → `picking_hours_used`
- **1.4 Labor Efficiency** → `labor_efficiency`
- **1.5 Labor Utilization (%)** → `labor_utilization_percent`

### Files Updated:
- ✅ `src/lib/dailyMetricReviewService.ts` - Interface and transform function updated
- ✅ `update-daily-metric-review-table.sql` - Database schema update script

## Step 3: Test the Upload Review Function
After running the SQL update:

1. Navigate to the dashboard
2. Click "📊 Upload Review" button  
3. Verify all new metrics are included in the upload
4. Check the `daily_metric_review` table to confirm all columns are populated

## Changes Made:
1. **Shipments Packed (1.1)** is now read-only and auto-syncs with Linnworks Total Orders (2.1)
2. **Role breakdown hours** (1.3.1, 1.3.2, 1.3.3) are now captured and exported
3. **All metrics** from the 1.x series are now included in the review export
4. **Database schema** expanded to capture the complete operational picture

The Upload Review function will now provide a comprehensive daily snapshot including all labor metrics with role breakdowns, maintaining full data integrity for analysis and reporting.
