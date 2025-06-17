-- Daily Employee Hours Table
-- This table stores the daily hours worked by each employee
-- One record per employee per day

CREATE TABLE daily_employee_hours (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Employee identification
    employee_id TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    employee_role TEXT NOT NULL,
    
    -- Date and hours information
    work_date DATE NOT NULL,
    hours_worked DECIMAL(4,2) NOT NULL DEFAULT 0.00, -- Supports values like 8.50 for 8.5 hours
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT, -- Can store user ID or name who entered the data
    
    -- Constraints
    CONSTRAINT hours_worked_valid CHECK (hours_worked >= 0 AND hours_worked <= 24),
    CONSTRAINT unique_employee_date UNIQUE (employee_id, work_date)
);

-- Index for faster queries by date
CREATE INDEX idx_daily_employee_hours_date ON daily_employee_hours(work_date);

-- Index for faster queries by employee
CREATE INDEX idx_daily_employee_hours_employee ON daily_employee_hours(employee_id);

-- Index for faster queries by date range
CREATE INDEX idx_daily_employee_hours_date_range ON daily_employee_hours(work_date, employee_id);

-- Trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_daily_employee_hours_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_employee_hours_updated_at
    BEFORE UPDATE ON daily_employee_hours
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_employee_hours_updated_at();

-- Row Level Security (RLS) - Enable if needed
-- ALTER TABLE daily_employee_hours ENABLE ROW LEVEL SECURITY;

-- Example policy (uncomment if using RLS)
-- CREATE POLICY "Allow all operations for authenticated users" ON daily_employee_hours
--     FOR ALL USING (auth.role() = 'authenticated');

-- Sample insert statement (for testing)
-- INSERT INTO daily_employee_hours (employee_id, employee_name, employee_role, work_date, hours_worked, created_by)
-- VALUES 
--     ('emp_001', 'Mark Gill', 'Supervisor', '2025-06-17', 8.0, 'system'),
--     ('emp_002', 'Jack Weston', 'Manager', '2025-06-17', 8.0, 'system'),
--     ('emp_003', 'Jamie Rumsey', 'Associate', '2025-06-17', 8.0, 'system');

-- Query to get daily totals by role (example)
-- SELECT 
--     employee_role,
--     COUNT(*) as employee_count,
--     SUM(hours_worked) as total_hours
-- FROM daily_employee_hours 
-- WHERE work_date = '2025-06-17'
-- GROUP BY employee_role
-- ORDER BY employee_role;

-- Query to get all hours for a specific date
-- SELECT 
--     employee_name,
--     employee_role,
--     hours_worked
-- FROM daily_employee_hours 
-- WHERE work_date = '2025-06-17'
-- ORDER BY employee_role, employee_name;
