-- Update daily_metric_review table to include new role breakdown metrics and shipments packed
-- This script adds the new columns needed for the updated dashboard metrics

-- Add shipments_packed column (now auto-populated from Linnworks orders)
ALTER TABLE daily_metric_review 
ADD COLUMN IF NOT EXISTS shipments_packed numeric DEFAULT 0;

-- Add role breakdown hours columns
ALTER TABLE daily_metric_review 
ADD COLUMN IF NOT EXISTS management_hours_used numeric DEFAULT 0;

ALTER TABLE daily_metric_review 
ADD COLUMN IF NOT EXISTS packing_hours_used numeric DEFAULT 0;

ALTER TABLE daily_metric_review 
ADD COLUMN IF NOT EXISTS picking_hours_used numeric DEFAULT 0;

-- Add scheduled hours column
ALTER TABLE daily_metric_review 
ADD COLUMN IF NOT EXISTS scheduled_hours numeric DEFAULT 0;

-- Add labor utilization percentage
ALTER TABLE daily_metric_review 
ADD COLUMN IF NOT EXISTS labor_utilization_percent numeric DEFAULT 0;

-- Update comments for new columns
COMMENT ON COLUMN daily_metric_review.shipments_packed IS 'Daily count of shipments packed (auto-populated from Linnworks total orders)';
COMMENT ON COLUMN daily_metric_review.management_hours_used IS 'Hours worked by management roles (Supervisor, Manager, B2C Accounts Manager)';
COMMENT ON COLUMN daily_metric_review.packing_hours_used IS 'Hours worked by packing roles (all Associate positions)';
COMMENT ON COLUMN daily_metric_review.picking_hours_used IS 'Hours worked by picking roles';
COMMENT ON COLUMN daily_metric_review.scheduled_hours IS 'Total scheduled work hours for the day';
COMMENT ON COLUMN daily_metric_review.labor_utilization_percent IS 'Labor utilization percentage (actual hours / scheduled hours * 100)';

-- Update the existing actual_hours_worked column comment to reflect it's now "Total Hours Used"
COMMENT ON COLUMN daily_metric_review.actual_hours_worked IS 'Total hours used (formerly actual hours worked) - sum of all employee hours from time tracking';
