-- Update import_records table for Phase 4 upload tracking
-- This script adds the new columns needed for progress tracking and upload history

-- Add new columns to import_records table
ALTER TABLE import_records 
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS import_type TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS total_records INTEGER,
ADD COLUMN IF NOT EXISTS processed_records INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS imported_records INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_records INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS created_by TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update status values to match new schema
UPDATE import_records SET status = 'processing' WHERE status = 'pending';
UPDATE import_records SET status = 'error' WHERE status = 'failed';

-- Copy data from old columns to new columns where they exist
UPDATE import_records 
SET 
  import_type = file_type,
  file_name = filename,
  total_records = records_total,
  processed_records = COALESCE(records_processed, 0),
  error_count = COALESCE(records_failed, 0),
  started_at = COALESCE(imported_at, created_at),
  error_message = errors
WHERE import_type IS NULL;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_import_records_session_id ON import_records(session_id);
CREATE INDEX IF NOT EXISTS idx_import_records_import_type ON import_records(import_type);
CREATE INDEX IF NOT EXISTS idx_import_records_created_by ON import_records(created_by);
CREATE INDEX IF NOT EXISTS idx_import_records_started_at ON import_records(started_at);
CREATE INDEX IF NOT EXISTS idx_import_records_completed_at ON import_records(completed_at);

-- Add trigger for updated_at
CREATE TRIGGER update_import_records_updated_at 
  BEFORE UPDATE ON import_records 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for new schema
COMMENT ON COLUMN import_records.session_id IS 'Unique session identifier for tracking upload progress';
COMMENT ON COLUMN import_records.import_type IS 'Type of data being imported (inventory, amazon_listings, etc.)';
COMMENT ON COLUMN import_records.file_name IS 'Original filename of uploaded file';
COMMENT ON COLUMN import_records.file_size IS 'Size of uploaded file in bytes';
COMMENT ON COLUMN import_records.total_records IS 'Total number of records in the import';
COMMENT ON COLUMN import_records.processed_records IS 'Number of records processed so far';
COMMENT ON COLUMN import_records.imported_records IS 'Number of new records imported';
COMMENT ON COLUMN import_records.updated_records IS 'Number of existing records updated';
COMMENT ON COLUMN import_records.error_count IS 'Number of records that failed to process';
COMMENT ON COLUMN import_records.started_at IS 'When the import process started';
COMMENT ON COLUMN import_records.completed_at IS 'When the import process completed';
COMMENT ON COLUMN import_records.error_message IS 'Error message if import failed';
COMMENT ON COLUMN import_records.created_by IS 'User ID who initiated the import';
