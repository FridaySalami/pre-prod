# Landing Page Documentation

## Overview

The landing page (`src/routes/landing/+page.svelte`) serves as the main dashboard for Parker's Foodservice management system. It provides a comprehensive view of daily operations including staff scheduling, leave management, performance metrics, and weather information.

## Page Structure

### Layout
- **Main Dashboard**: Two-column grid layout (main content + sidebar)
- **Main Column**: Weekly staffing schedules and upcoming leave
- **Sidebar**: Performance metrics and weather widget
- **Responsive**: Adapts to mobile screens with stacked layout

### Data Sources

The landing page aggregates data from multiple sources:

#### 1. Staff Scheduling Data
- **Tables**: `schedules`, `employee_schedules`, `employees`
- **Purpose**: Shows current and next week's staff assignments
- **Update Frequency**: Real-time based on schedule changes

#### 2. Leave Management Data
- **Tables**: `leave_requests`, `employees`
- **Purpose**: Displays upcoming approved leave requests
- **Update Frequency**: Real-time based on leave request approvals

#### 3. Performance Metrics Data
- **Primary Table**: `daily_metric_review`
- **Fallback Table**: `daily_metrics`
- **Purpose**: Shows yesterday's operational performance
- **Update Frequency**: Daily (populated by overnight data processing)

#### 4. Weather Data
- **External API**: WeatherAPI.com
- **Purpose**: Current weather and tomorrow's forecast
- **Update Frequency**: Real-time API calls

## Dependencies

### Core Dependencies

#### Database Tables
1. **employees**
   - `id` (UUID, Primary Key)
   - `name` (Text)
   - `role` (Text)
   - `email` (Text, Optional)

2. **schedules** (Specific date assignments)
   - `id` (UUID, Primary Key)
   - `employee_id` (UUID, Foreign Key → employees.id)
   - `date` (Date)
   - `shift` (Text: 'morning', 'afternoon', 'evening')

3. **employee_schedules** (Recurring patterns)
   - `id` (UUID, Primary Key)
   - `employee_id` (UUID, Foreign Key → employees.id)
   - `day_of_week` (Integer: 0=Monday, 1=Tuesday, ..., 6=Sunday)
   - `is_working` (Boolean)
   - `shift` (Text: 'morning', 'afternoon', 'evening')

4. **leave_requests**
   - `id` (UUID, Primary Key)
   - `employee_id` (UUID, Foreign Key → employees.id)
   - `start_date` (Date)
   - `end_date` (Date)
   - `leave_type` (Text)
   - `status` (Text: 'pending', 'approved', 'rejected')

5. **daily_metric_review** (Primary metrics source)
   - `date` (Date, Primary Key)
   - `total_sales` (Decimal)
   - `amazon_sales` (Decimal)
   - `ebay_sales` (Decimal)
   - `shopify_sales` (Decimal)
   - `linnworks_total_orders` (Integer)
   - `linnworks_amazon_orders` (Integer)
   - `linnworks_ebay_orders` (Integer)
   - `linnworks_shopify_orders` (Integer)
   - `amazon_orders_percent` (Decimal)
   - `ebay_orders_percent` (Decimal)
   - `shopify_orders_percent` (Decimal)
   - `actual_hours_worked` (Decimal)
   - `labor_efficiency` (Decimal)
   - `packing_hours_used` (Decimal)
   - `picking_hours_used` (Decimal)

6. **daily_metrics** (Fallback metrics source)
   - `date` (Date, Primary Key)
   - `shipments` (Integer)
   - `hours_worked` (Decimal)
   - `scheduled_hours` (Decimal)

#### External Services
1. **WeatherAPI.com**
   - **API Key**: Required (stored in environment variables)
   - **Location**: "BN18 0BF" (hardcoded)
   - **Data**: Current conditions + 2-day forecast

#### UI Components (ShadCN)
- `Card`, `CardHeader`, `CardTitle`, `CardContent`
- `Skeleton` (loading states)
- `Alert`, `AlertTitle`, `AlertDescription`
- `Badge`

#### Authentication
- **Supabase Auth**: User session management
- **Session Store**: Reactive session state (`$lib/sessionStore`)
- **Route Protection**: Redirects to `/login` if not authenticated

## Data Processing Logic

### Staff Scheduling Logic
1. **Week Calculation**: Monday-Saturday (excludes Sunday)
2. **Schedule Priority**: Specific date assignments override recurring patterns
3. **Leave Integration**: Staff marked as "on leave" are visually distinguished
4. **Role Grouping**: Staff sorted by role hierarchy (Manager → Supervisor → Team Lead → Senior → Associate)

### Metrics Processing
1. **Primary Source**: `daily_metric_review` table (comprehensive metrics)
2. **Fallback Logic**: If primary fails, uses `daily_metrics` table (basic metrics)
3. **Labor Efficiency**: Calculated as Orders ÷ (Packing Hours + Picking Hours)
4. **Date Range**: Always shows yesterday's data

### Leave Management Logic
1. **Date Ranges**: Groups consecutive leave days for same employee
2. **Status Filter**: Only shows approved leave requests
3. **Time Window**: Shows upcoming leave starting from today
4. **Display Limit**: Maximum 8 leave entries

## Maintenance Requirements

### Daily Maintenance
1. **Metrics Data Population**
   - Ensure `daily_metric_review` table is populated with yesterday's data
   - Verify all metrics fields are correctly calculated
   - Monitor fallback to `daily_metrics` if primary data missing

### Weekly Maintenance
1. **Staff Schedule Verification**
   - Ensure `schedules` table has upcoming specific assignments
   - Verify `employee_schedules` patterns are up-to-date
   - Check for scheduling conflicts or gaps

2. **Leave Request Processing**
   - Approve/reject pending leave requests
   - Ensure leave dates don't conflict with critical operations
   - Update leave status in `leave_requests` table

### As-Needed Maintenance
1. **Employee Data Updates**
   - Add new employees to `employees` table
   - Update roles and contact information
   - Manage departing employees

2. **Weather API Management**
   - Monitor API key validity and usage limits
   - Update location if business relocates
   - Handle API failures gracefully

## Troubleshooting

### Common Issues

#### 1. Staff Not Showing on Schedule
**Symptoms**: Staff missing from weekly view despite being scheduled
**Causes**:
- Incorrect `day_of_week` mapping (DB: 0=Monday vs JS: 0=Sunday)
- `is_working` flag set to false in `employee_schedules`
- Missing employee record in `employees` table

**Resolution**:
```sql
-- Check schedule patterns
SELECT es.*, e.name 
FROM employee_schedules es 
JOIN employees e ON es.employee_id = e.id 
WHERE es.day_of_week = 0 AND es.is_working = true;

-- Check specific schedules
SELECT s.*, e.name 
FROM schedules s 
JOIN employees e ON s.employee_id = e.id 
WHERE s.date >= CURRENT_DATE;
```

#### 2. Metrics Not Loading
**Symptoms**: Performance metrics show zeros or loading indefinitely
**Causes**:
- Missing data in `daily_metric_review` table
- Date format mismatch
- Database connection issues

**Resolution**:
```sql
-- Check metrics data
SELECT * FROM daily_metric_review 
WHERE date = CURRENT_DATE - INTERVAL '1 day';

-- Check fallback data
SELECT * FROM daily_metrics 
WHERE date = CURRENT_DATE - INTERVAL '1 day';
```

#### 3. Weather Not Loading
**Symptoms**: Weather widget shows error or loading state
**Causes**:
- API key expired or invalid
- Network connectivity issues
- API rate limits exceeded

**Resolution**:
- Verify API key in environment variables
- Check WeatherAPI.com account status
- Monitor API usage limits

#### 4. Leave Not Displaying
**Symptoms**: Approved leave requests not showing in upcoming leave
**Causes**:
- Leave requests not properly approved (`status` != 'approved')
- Date range issues
- Employee association problems

**Resolution**:
```sql
-- Check leave requests
SELECT lr.*, e.name 
FROM leave_requests lr 
JOIN employees e ON lr.employee_id = e.id 
WHERE lr.status = 'approved' 
AND lr.start_date >= CURRENT_DATE;
```

## Data Update Procedures

### Adding New Employees
1. Insert into `employees` table
2. Create schedule patterns in `employee_schedules`
3. Add specific assignments in `schedules` as needed

### Updating Staff Schedules
1. **Recurring Changes**: Update `employee_schedules` table
2. **One-time Changes**: Add/update `schedules` table entries
3. **Leave Coverage**: Create temporary schedule assignments

### Processing Metrics
1. **Daily Data Upload**: Populate `daily_metric_review` table
2. **Data Validation**: Verify all required fields are present
3. **Error Handling**: Ensure fallback data in `daily_metrics` exists

## Performance Considerations

### Loading Optimization
- Parallel data fetching where possible
- Timeout mechanisms for external API calls
- Graceful degradation for missing data

### Error Handling
- Retry logic for failed requests
- Fallback data sources
- User-friendly error messages

### Caching Strategy
- Weather data could be cached for 30 minutes
- Staff schedules cached until next update
- Metrics cached for current day

## Security Considerations

### Authentication
- All data access requires valid Supabase session
- Automatic redirect to login for unauthorized users
- Session timeout handling

### Data Access
- Row-level security in Supabase
- API key protection for weather service
- Sensitive data exclusion from client-side logging

## Future Enhancements

### Potential Improvements
1. **Real-time Updates**: WebSocket connections for live schedule changes
2. **Mobile Optimization**: Progressive Web App features
3. **Customizable Metrics**: User-selectable KPIs
4. **Predictive Analytics**: Forecasting based on historical data
5. **Notification System**: Alerts for schedule changes or critical metrics

### Technical Debt
1. **Error Boundary**: Implement global error handling
2. **Performance Monitoring**: Add client-side performance tracking
3. **Accessibility**: Improve ARIA labels and keyboard navigation
4. **Testing**: Add unit and integration tests

## Related Pages

The landing page serves as the entry point but users navigate to specialized pages for detailed management:

1. **Schedule Management**: Staff scheduling and time tracking
2. **Metrics Dashboard**: Detailed performance analytics
3. **Leave Management**: Leave request processing
4. **Employee Management**: Staff information and role management

Each of these pages shares dependencies with the landing page and should be documented with similar detail for comprehensive system maintenance.
