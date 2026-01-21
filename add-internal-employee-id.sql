-- Add internal_employee_id to match with employees table
ALTER TABLE holidays 
ADD COLUMN IF NOT EXISTS internal_employee_id UUID REFERENCES employees(id);
