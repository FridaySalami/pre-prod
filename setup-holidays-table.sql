-- Create holidays table to store imported data from myHRtoolkit
CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY, -- Maps to myHRtoolkit ID
  user_id INTEGER,
  employee_name TEXT,
  from_date TIMESTAMP WITH TIME ZONE,
  to_date TIMESTAMP WITH TIME ZONE,
  duration TEXT,
  units TEXT,
  notes TEXT,
  status TEXT,
  date_holiday_requested_to_be_withdrawn TIMESTAMP WITH TIME ZONE,
  dates_to_exclude TEXT,
  raw_data JSONB, -- Store full JSON just in case
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to view holidays
CREATE POLICY "Allow authenticated users to view all holidays"
ON holidays FOR SELECT
TO authenticated
USING (true);

-- Create policy to allow authenticated users to insert/update (or restrict to admins/system)
CREATE POLICY "Allow authenticated users to insert/update holidays"
ON holidays FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
