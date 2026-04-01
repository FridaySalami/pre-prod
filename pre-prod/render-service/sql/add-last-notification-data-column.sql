-- Add last_notification_data column to current_state table
-- This stores the full notification JSON for UI display

ALTER TABLE current_state 
ADD COLUMN IF NOT EXISTS last_notification_data JSONB;

-- Add index for faster JSONB queries
CREATE INDEX IF NOT EXISTS idx_current_state_notification_data 
  ON current_state USING gin(last_notification_data);

-- Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'current_state' 
ORDER BY ordinal_position;
