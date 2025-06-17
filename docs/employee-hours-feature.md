# Employee Hours Submission Feature

## Overview
This feature allows users to submit work hours for employees on specific dates. It consists of a web interface for data entry and a database structure to store the information.

## Components

### 1. Database Tables

#### Employees Table (existing)
- `uuid` (Primary Key)
- `name` (Text)
- `email` (Text)
- `created_at` (Timestamp)

#### Employee Hours Table (new)
- `id` (UUID, Primary Key)
- `employee_id` (UUID, Foreign Key to employees.uuid)
- `date` (Date)
- `hours` (Decimal, 0-24 hours allowed)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### 2. Web Interface
Location: `/employee-hours`

#### Features:
- **Employee List**: Displays all employees from the database
- **Date Picker**: HTML5 date input for selecting the work date
- **Hours Input**: Numeric inputs for each employee (0-24 hours, 0.5 increments)
- **Real-time Summary**: Shows total hours and number of employees with hours
- **Validation**: Prevents submission without any hours entered
- **Toast Notifications**: Success/error feedback

#### User Flow:
1. Select a date using the date picker
2. Enter hours worked for each employee
3. Review the summary
4. Click "Submit Hours" to save to database

### 3. Database Setup

#### Run these SQL commands in your Supabase database:

1. **Create the employee_hours table:**
```sql
-- Execute setup-employee-hours-table.sql
```

2. **Add test employees (optional):**
```sql
-- Execute add-test-employees.sql
```

#### Key Features:
- **Unique Constraint**: Prevents duplicate entries for same employee on same date
- **Check Constraints**: Ensures hours are between 0 and 24
- **Foreign Key**: Links to employees table with CASCADE delete
- **Indexes**: Optimized for queries by employee, date, and employee+date
- **RLS**: Row Level Security enabled for authenticated users
- **Auto-timestamps**: Automatic created_at and updated_at handling

### 4. Security
- Row Level Security (RLS) is enabled
- Only authenticated users can perform operations
- Foreign key constraints ensure data integrity

### 5. Future Enhancements
- Edit existing hour entries
- Bulk import/export functionality
- Reporting and analytics
- Approval workflow
- Time tracking integration

## Usage

1. Navigate to `/employee-hours` in your application
2. Ensure you have employees in the `employees` table
3. Select a date and enter hours for employees
4. Submit the form to save hours to the database

## Files Created/Modified

- `/src/routes/employee-hours/+page.svelte` - Main page component
- `/setup-employee-hours-table.sql` - Database schema
- `/add-test-employees.sql` - Test data for employees table
- `/docs/employee-hours-feature.md` - This documentation
