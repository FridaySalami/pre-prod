-- Add test employees to the employees table
INSERT INTO employees (name, role) VALUES
    ('John Smith', 'Manager'),
    ('Sarah Johnson', 'Manager'), 
    ('Michael Brown', 'Supervisor'),
    ('Emily Davis', 'Supervisor'),
    ('David Wilson', 'Associate'),
    ('Jessica Taylor', 'Associate'),
    ('Chris Anderson', 'Associate'),
    ('Amanda Martinez', 'Associate')
ON CONFLICT (name) DO NOTHING;
