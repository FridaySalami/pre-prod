# Employee Hours Feature Documentation

## Overview

The Employee Hours feature allows managers to track and record daily working hours for all employees. This system provides an intuitive interface for entering hours, viewing role-based summaries, and maintaining historical records.

## Key Features

### 1. Daily Hour Tracking
- **Date Selection**: Select any date to view/edit hours for that day
- **Employee List**: All employees displayed with their roles and current hour inputs
- **Real-time Totals**: Automatic calculation of totals by role and overall
- **Unsaved Changes Detection**: Visual indicators when changes haven't been saved

### 2. Role-Based Organization
- **Hierarchical Display**: Employees sorted by role priority (Managers/Supervisors → Associates → Others)
- **Role Summaries**: Breakdown showing employee count and total hours per role
- **Alphabetical Sorting**: Within each role, employees sorted by surname

### 3. Data Persistence
- **Auto-save**: Hours are saved to the database on user action
- **Historical Data**: View and edit hours for any previous date
- **Upsert Logic**: Updates existing records or creates new ones as needed

## Technical Architecture

### Page Structure
**File**: `/src/routes/employee-hours/+page.svelte`

```svelte
<script lang="ts">
  // Authentication and navigation
  import { userSession } from '$lib/sessionStore';
  import { goto } from '$app/navigation';
  
  // Data services
  import { getEmployees } from '$lib/employeeHoursService';
  import { saveDailyHours, getDailyHours } from '$lib/dailyHoursService';
  
  // State management
  let employees: Employee[] = $state([]);
  let selectedDate = $state(new Date().toISOString().split('T')[0]);
  let employeeHours: Record<string, number> = $state({});
  
  // Derived calculations
  let employeesWithHours = $derived(() => {
    // Sort by role priority, then alphabetically by surname
  });
  
  let roleBreakdown = $derived(() => {
    // Calculate totals by role
  });
</script>
```

### Data Services

#### Employee Hours Service (`/src/lib/employeeHoursService.ts`)
- **Purpose**: Handles employee data and basic hour operations
- **Key Functions**:
  - `getEmployees()`: Fetches all employees with roles
  - `submitEmployeeHours()`: Submits hour records
  - `getHoursForDate()`: Retrieves hours for a specific date

#### Daily Hours Service (`/src/lib/dailyHoursService.ts`)
- **Purpose**: Manages daily hour tracking with enhanced features
- **Key Functions**:
  - `saveDailyHours()`: Upserts daily hour records
  - `getDailyHours()`: Retrieves hours for a specific date
  - `checkHoursExist()`: Checks if hours exist for a date

### Database Schema

#### Tables Used
1. **`employees`**
   - `id` (primary key)
   - `name` (employee full name)
   - `role` (job title/role)

2. **`daily_employee_hours`**
   - `id` (primary key)
   - `employee_id` (foreign key)
   - `employee_name` (denormalized for performance)
   - `employee_role` (denormalized for performance)
   - `work_date` (YYYY-MM-DD format)
   - `hours_worked` (decimal)
   - `created_at`, `updated_at` (timestamps)
   - `created_by` (user who entered the data)

## User Interface Components

### 1. Date Selector
```svelte
<input
  type="date"
  bind:value={selectedDate}
  onchange={onDateChange}
  class="..."
/>
```

### 2. Employee Hours Input
```svelte
{#each employeesWithHours() as employee}
  <div class="employee-row">
    <span>{employee.name}</span>
    <span>{employee.role}</span>
    <input
      type="number"
      bind:value={employeeHours[employee.id]}
      min="0"
      max="24"
      step="0.5"
    />
  </div>
{/each}
```

### 3. Role Summary Cards
```svelte
{#each Object.entries(roleBreakdown()) as [role, data]}
  <div class="role-card">
    <h3>{role}</h3>
    <p>{data.employees} employees</p>
    <p>{data.totalHours} total hours</p>
  </div>
{/each}
```

## State Management

### Reactive State Variables
- `employees`: Array of all employees
- `selectedDate`: Currently selected date
- `employeeHours`: Object mapping employee IDs to hours
- `loading`: Loading state for data fetching
- `saving`: Saving state for data persistence
- `saveStatus`: Status of last save operation
- `hasExistingData`: Whether data exists for selected date
- `savedHours`: Last saved state for change detection

### Derived State
- `employeesWithHours`: Employees with their hours and sorted by role/name
- `roleBreakdown`: Summary statistics by role
- `grandTotal`: Total hours across all employees
- `hasUnsavedChanges`: Whether current state differs from saved state

## Key Functions

### Authentication & Initialization
```typescript
onMount(async () => {
  // Wait for session to be determined
  const sessionTimeout = new Promise((resolve) => setTimeout(() => resolve(null), 5000));
  
  // Check authentication
  if (currentSession === null) {
    goto('/login');
    return;
  }
  
  // Load data
  await loadEmployees();
  await loadExistingHours();
});
```

### Data Loading
```typescript
async function loadEmployees() {
  try {
    loading = true;
    employees = await getEmployees();
    
    // Initialize hours for all employees to 0
    const initialHours: Record<string, number> = {};
    employees.forEach((emp) => {
      initialHours[emp.id] = 0;
    });
    employeeHours = initialHours;
  } catch (err) {
    error = err.message;
  } finally {
    loading = false;
  }
}

async function loadExistingHours() {
  try {
    const existingHours = await getDailyHours(selectedDate);
    hasExistingData = existingHours.length > 0;
    
    if (hasExistingData) {
      const hoursMap: Record<string, number> = {};
      existingHours.forEach((record) => {
        hoursMap[record.employee_id] = record.hours_worked;
      });
      employeeHours = { ...employeeHours, ...hoursMap };
      savedHours = { ...hoursMap };
    }
  } catch (err) {
    console.error('Error loading existing hours:', err);
  }
}
```

### Data Saving
```typescript
async function saveHours() {
  try {
    saving = true;
    
    const employeesForSave = employees.map((emp) => ({
      id: emp.id,
      name: emp.name,
      role: emp.role || 'Unknown'
    }));
    
    const result = await saveDailyHours(
      employeeHours,
      employeesForSave,
      selectedDate,
      'system'
    );
    
    if (result.success) {
      saveStatus = 'success';
      hasExistingData = true;
      savedHours = { ...employeeHours };
    } else {
      saveStatus = 'error';
      error = result.error;
    }
  } catch (err) {
    saveStatus = 'error';
    error = err.message;
  } finally {
    saving = false;
  }
}
```

## Dependencies

### External Dependencies
- **Svelte**: Framework for reactive UI
- **SvelteKit**: Routing and navigation
- **Supabase**: Database operations
- **TypeScript**: Type safety

### Internal Dependencies
- **`$lib/sessionStore`**: User authentication state
- **`$lib/employeeHoursService`**: Employee data operations
- **`$lib/dailyHoursService`**: Daily hours operations
- **`$lib/supabaseClient`**: Database connection

## Error Handling

### Authentication Errors
- Redirects to login page if no session
- Shows error messages for authentication failures

### Data Loading Errors
- Displays error messages for failed employee loading
- Logs errors for failed hour loading (non-blocking)

### Saving Errors
- Shows error status and message
- Prevents navigation away with unsaved changes

## Styling & UX

### Visual States
- **Loading**: Spinner during data operations
- **Saving**: Disabled inputs with loading indicator
- **Success**: Green checkmark with success message
- **Error**: Red error message with details
- **Unsaved Changes**: Warning indicator

### Role-Based Styling
- Different colors for different roles
- Hierarchical visual organization
- Clear role labels and summaries

## Security Considerations

### Authentication
- Requires valid user session
- Redirects unauthenticated users to login

### Data Validation
- Numeric constraints on hour inputs (0-24)
- Date validation for work dates
- Employee ID validation

### Database Security
- Row-level security policies
- Parameterized queries
- Error message sanitization

## Performance Optimizations

### Data Loading
- Parallel loading of employees and existing hours
- Minimal database queries per page load

### Reactive Updates
- Derived state calculations only run when dependencies change
- Efficient sorting and filtering algorithms

### UI Responsiveness
- Non-blocking error handling
- Optimistic UI updates
- Debounced save operations

## Maintenance Guide

### Adding New Employees
1. Add employee to `employees` table
2. Employee will automatically appear in the interface
3. No code changes required

### Modifying Roles
1. Update role in `employees` table
2. Adjust role priority in sorting logic if needed
3. Update role-based styling if desired

### Database Maintenance
1. Monitor `daily_employee_hours` table size
2. Consider archiving old records
3. Ensure proper indexing on frequently queried columns

### Troubleshooting Common Issues

#### Hours Not Saving
- Check network connectivity
- Verify Supabase connection
- Check browser console for errors
- Ensure valid date format

#### Employees Not Loading
- Verify `employees` table structure
- Check RLS policies
- Confirm user authentication

#### Performance Issues
- Check database query performance
- Monitor network requests
- Review derived state calculations

## Future Enhancements

### Potential Features
1. **Bulk Operations**: Copy hours from previous day
2. **Hour Templates**: Save common hour patterns
3. **Reporting**: Generate weekly/monthly reports
4. **Notifications**: Remind managers to enter hours
5. **Audit Trail**: Track who made changes when
6. **Time Tracking**: Integration with time clock systems

### Technical Improvements
1. **Offline Support**: Local storage for when offline
2. **Real-time Updates**: Live updates when multiple users editing
3. **Advanced Validation**: Business rule validation
4. **Export/Import**: CSV/Excel integration
5. **Mobile App**: Native mobile application
