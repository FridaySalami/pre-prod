-- Add missing updated_at column to buybox_jobs table
-- This fixes the "Could not find the 'updated_at' column" error

ALTER TABLE buybox_jobs 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if it exists and create it
DROP TRIGGER IF EXISTS update_buybox_jobs_updated_at ON buybox_jobs;
CREATE TRIGGER update_buybox_jobs_updated_at
    BEFORE UPDATE ON buybox_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update existing rows to have an updated_at timestamp
UPDATE buybox_jobs 
SET updated_at = COALESCE(completed_at, started_at, NOW())
WHERE updated_at IS NULL;

-- Comment on the new column
COMMENT ON COLUMN buybox_jobs.updated_at IS 'Timestamp of last update to this job record';
