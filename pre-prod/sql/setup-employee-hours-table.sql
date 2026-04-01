-- Create employee_hours table for storing submitted hours
CREATE TABLE IF NOT EXISTS employee_hours (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    hours DECIMAL(5,2) NOT NULL CHECK (hours >= 0 AND hours <= 24),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create an index for faster queries by employee and date
CREATE INDEX IF NOT EXISTS idx_employee_hours_employee_date ON employee_hours(employee_id, date);

-- Create an index for faster queries by date
CREATE INDEX IF NOT EXISTS idx_employee_hours_date ON employee_hours(date);

-- Create a unique constraint to prevent duplicate entries for same employee on same date
ALTER TABLE employee_hours 
ADD CONSTRAINT unique_employee_date 
UNIQUE (employee_id, date);

-- Add RLS (Row Level Security) policies if needed
ALTER TABLE employee_hours ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for authenticated users
-- You may want to customize this based on your authentication requirements
CREATE POLICY "Allow all operations for authenticated users" ON employee_hours
    FOR ALL USING (auth.role() = 'authenticated');

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_employee_hours_updated_at 
    BEFORE UPDATE ON employee_hours 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
