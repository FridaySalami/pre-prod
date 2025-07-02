# Database Schema Documentation

## Overview

This document provides comprehensive documentation for the Parker's Foodservice database schema, including table structures, relationships, and data flow patterns. The database uses PostgreSQL with Supabase for hosting and real-time features.

## Core Tables

### 1. Employee Management

#### `employees`
Stores basic employee information and roles.

```sql
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    role TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Relationships:**
- Referenced by `employee_schedules`, `daily_employee_hours`, `leave_requests`
- Used in schedule and hour tracking across the system

#### `daily_employee_hours`
Tracks daily working hours for each employee.

```sql
CREATE TABLE daily_employee_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    employee_role TEXT NOT NULL,
    work_date DATE NOT NULL,
    hours_worked DECIMAL(4,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT,
    UNIQUE(employee_id, work_date)
);
```

**Key Features:**
- Denormalized employee data for performance
- Unique constraint prevents duplicate entries per day
- Supports upsert operations for efficient updates

### 2. Schedule Management

#### `employee_schedules`
Stores specific date-based schedules for employees.

```sql
CREATE TABLE employee_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    schedule_date DATE NOT NULL,
    shift_start TIME,
    shift_end TIME,
    is_working BOOLEAN DEFAULT true,
    hours_scheduled DECIMAL(4,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `schedule_patterns`
Defines recurring weekly schedule patterns.

```sql
CREATE TABLE schedule_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    shift_start TIME,
    shift_end TIME,
    is_working BOOLEAN DEFAULT true,
    effective_from DATE,
    effective_until DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Notes:**
- `day_of_week`: 0 = Monday, 6 = Sunday (database convention)
- Supports date ranges for pattern validity

#### `leave_requests`
Manages employee leave requests and approvals.

```sql
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'pending',
    reason TEXT,
    approved_by UUID REFERENCES employees(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Leave Types:**
- Annual Leave
- Sick Leave
- Emergency Leave
- Unpaid Leave

### 3. Analytics & Metrics

#### `daily_metric_review`
Primary table for daily business metrics and KPIs.

```sql
CREATE TABLE daily_metric_review (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_date DATE NOT NULL UNIQUE,
    total_sales DECIMAL(10,2),
    total_orders INTEGER,
    amazon_sales DECIMAL(10,2),
    ebay_sales DECIMAL(10,2),
    shopify_sales DECIMAL(10,2),
    other_channel_sales DECIMAL(10,2),
    total_profit DECIMAL(10,2),
    labor_efficiency DECIMAL(5,2),
    average_order_value DECIMAL(8,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `daily_metrics` (Fallback)
Backup metrics table for data redundancy.

```sql
CREATE TABLE daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    total_sales DECIMAL(10,2),
    total_orders INTEGER,
    labor_efficiency DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4. Historical Data

#### `historical_sales_data`
Long-term storage for historical analysis and trend calculations.

```sql
CREATE TABLE historical_sales_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_date DATE NOT NULL,
    channel TEXT NOT NULL,
    sales_amount DECIMAL(10,2),
    order_count INTEGER,
    profit_amount DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Data Relationships

### Employee-Schedule Relationships
```
employees (1) ----< employee_schedules (many)
employees (1) ----< schedule_patterns (many)
employees (1) ----< leave_requests (many)
employees (1) ----< daily_employee_hours (many)
```

### Metrics Relationships
```
daily_metric_review (1) ----< historical_sales_data (many)
daily_metrics (fallback) ----< daily_metric_review (primary)
```

## Indexes and Performance

### Primary Indexes
```sql
-- Employee lookups
CREATE INDEX idx_employees_role ON employees(role);
CREATE INDEX idx_employees_name ON employees(name);

-- Schedule queries
CREATE INDEX idx_employee_schedules_date ON employee_schedules(schedule_date);
CREATE INDEX idx_employee_schedules_employee_date ON employee_schedules(employee_id, schedule_date);

-- Hour tracking
CREATE INDEX idx_daily_hours_date ON daily_employee_hours(work_date);
CREATE INDEX idx_daily_hours_employee_date ON daily_employee_hours(employee_id, work_date);

-- Metrics and analytics
CREATE INDEX idx_daily_metrics_date ON daily_metric_review(metric_date);
CREATE INDEX idx_historical_sales_date_channel ON historical_sales_data(sales_date, channel);
```

### Composite Indexes
```sql
-- Schedule pattern lookups
CREATE INDEX idx_schedule_patterns_employee_day ON schedule_patterns(employee_id, day_of_week);

-- Leave request queries
CREATE INDEX idx_leave_requests_employee_dates ON leave_requests(employee_id, start_date, end_date);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
```

## Data Integrity Rules

### Constraints
```sql
-- Employee hours validation
ALTER TABLE daily_employee_hours 
ADD CONSTRAINT chk_hours_valid 
CHECK (hours_worked >= 0 AND hours_worked <= 24);

-- Date validations
ALTER TABLE leave_requests 
ADD CONSTRAINT chk_leave_dates 
CHECK (end_date >= start_date);

-- Schedule time validations
ALTER TABLE employee_schedules 
ADD CONSTRAINT chk_shift_times 
CHECK (shift_end > shift_start OR shift_start IS NULL OR shift_end IS NULL);
```

### Foreign Key Cascades
```sql
-- Cascading deletes for employee removal
employee_schedules.employee_id ON DELETE CASCADE
schedule_patterns.employee_id ON DELETE CASCADE
leave_requests.employee_id ON DELETE CASCADE
daily_employee_hours.employee_id ON DELETE CASCADE
```

## Row Level Security (RLS)

### Authentication Policies
```sql
-- Enable RLS on sensitive tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_employee_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_schedules ENABLE ROW LEVEL SECURITY;

-- Basic authenticated user policy
CREATE POLICY "authenticated_users_full_access" ON employees
FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_users_hours_access" ON daily_employee_hours
FOR ALL USING (auth.role() = 'authenticated');
```

## Data Flow Patterns

### 1. Landing Page Data Flow
```
daily_metric_review (primary) 
    ↓ (if empty)
daily_metrics (fallback)
    ↓
Landing Page Metrics Display
```

### 2. Schedule Management Flow
```
schedule_patterns (weekly templates)
    ↓ (generates)
employee_schedules (specific dates)
    ↓ (conflicts with)
leave_requests (approved leave)
    ↓ (final display)
Schedule Calendar
```

### 3. Analytics Data Flow
```
External APIs (Linnworks, etc.)
    ↓ (populates)
daily_metric_review
    ↓ (aggregates to)
historical_sales_data
    ↓ (displays in)
Analytics Dashboard
```

## Backup and Maintenance

### Daily Maintenance
```sql
-- Clean up old metrics (keep 2 years)
DELETE FROM daily_metrics 
WHERE date < CURRENT_DATE - INTERVAL '2 years';

-- Update employee hour summaries
REFRESH MATERIALIZED VIEW IF EXISTS employee_hour_summaries;
```

### Weekly Maintenance
```sql
-- Archive old leave requests (completed > 1 year)
UPDATE leave_requests 
SET archived = true 
WHERE status IN ('approved', 'completed') 
AND end_date < CURRENT_DATE - INTERVAL '1 year';

-- Clean up orphaned schedule records
DELETE FROM employee_schedules 
WHERE employee_id NOT IN (SELECT id FROM employees);
```

### Performance Monitoring
```sql
-- Monitor table sizes
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;
```

## Migration Scripts

### Adding New Columns
```sql
-- Example: Adding new metric fields
ALTER TABLE daily_metric_review
ADD COLUMN IF NOT EXISTS customer_satisfaction DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS return_rate DECIMAL(5,2);

-- Update existing records with defaults
UPDATE daily_metric_review 
SET customer_satisfaction = 0.0, return_rate = 0.0 
WHERE customer_satisfaction IS NULL;
```

### Schema Updates
```sql
-- Example: Modifying employee role structure
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS department TEXT;

-- Migrate existing roles to departments
UPDATE employees 
SET department = CASE 
    WHEN role IN ('Manager', 'Supervisor') THEN 'Management'
    WHEN role = 'Associate' THEN 'Operations'
    ELSE 'General'
END;
```

## Common Queries

### Employee Scheduling
```sql
-- Get current week's schedule for all employees
SELECT 
    e.name,
    e.role,
    es.schedule_date,
    es.shift_start,
    es.shift_end,
    es.hours_scheduled
FROM employees e
LEFT JOIN employee_schedules es ON e.id = es.employee_id
WHERE es.schedule_date BETWEEN 
    date_trunc('week', CURRENT_DATE) AND 
    date_trunc('week', CURRENT_DATE) + INTERVAL '6 days'
ORDER BY e.role, e.name, es.schedule_date;
```

### Hours Analysis
```sql
-- Weekly hour totals by employee
SELECT 
    employee_name,
    employee_role,
    DATE_TRUNC('week', work_date) as week_start,
    SUM(hours_worked) as total_hours,
    COUNT(*) as days_worked
FROM daily_employee_hours
WHERE work_date >= CURRENT_DATE - INTERVAL '4 weeks'
GROUP BY employee_name, employee_role, DATE_TRUNC('week', work_date)
ORDER BY week_start DESC, employee_role, employee_name;
```

### Performance Metrics
```sql
-- Monthly sales performance with trends
SELECT 
    DATE_TRUNC('month', metric_date) as month,
    SUM(total_sales) as monthly_sales,
    SUM(total_orders) as monthly_orders,
    AVG(labor_efficiency) as avg_efficiency,
    LAG(SUM(total_sales)) OVER (ORDER BY DATE_TRUNC('month', metric_date)) as prev_month_sales,
    ROUND(
        ((SUM(total_sales) - LAG(SUM(total_sales)) OVER (ORDER BY DATE_TRUNC('month', metric_date))) / 
         LAG(SUM(total_sales)) OVER (ORDER BY DATE_TRUNC('month', metric_date))) * 100, 2
    ) as sales_growth_percent
FROM daily_metric_review
WHERE metric_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', metric_date)
ORDER BY month DESC;
```

## Security Considerations

### Data Protection
- All employee data is protected by RLS policies
- Sensitive financial data requires authenticated access
- Audit trails maintained for all critical operations

### Access Control
```sql
-- Create role-based access
CREATE ROLE manager_role;
CREATE ROLE employee_role;

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON employees TO manager_role;
GRANT SELECT ON employees TO employee_role;

GRANT ALL ON daily_employee_hours TO manager_role;
GRANT SELECT, UPDATE ON daily_employee_hours TO employee_role;
```

### Data Encryption
- All connections use SSL/TLS encryption
- Sensitive fields can be encrypted at application level
- Backup files are encrypted at rest

## Troubleshooting

### Common Issues

#### Data Inconsistencies
```sql
-- Find employees without schedules
SELECT e.name, e.role
FROM employees e
LEFT JOIN employee_schedules es ON e.id = es.employee_id
WHERE es.id IS NULL AND e.created_at < CURRENT_DATE - INTERVAL '1 week';

-- Find schedules without employees (orphaned records)
SELECT es.*
FROM employee_schedules es
LEFT JOIN employees e ON es.employee_id = e.id
WHERE e.id IS NULL;
```

#### Performance Issues
```sql
-- Identify slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE query LIKE '%daily_metric_review%'
ORDER BY total_time DESC
LIMIT 10;

-- Check for missing indexes
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE schemaname = 'public'
AND correlation < 0.1
ORDER BY n_distinct DESC;
```

## Future Enhancements

### Planned Schema Changes
1. **Audit Logging**: Add comprehensive audit tables
2. **Permissions System**: Role-based access control tables
3. **Notifications**: System notification and alerting tables
4. **Reporting Cache**: Materialized views for complex reports
5. **Integration Logs**: API call logging and monitoring tables

### Performance Optimizations
1. **Partitioning**: Date-based partitioning for large tables
2. **Materialized Views**: Pre-computed aggregations
3. **Connection Pooling**: Database connection optimization
4. **Query Optimization**: Index tuning and query refactoring
