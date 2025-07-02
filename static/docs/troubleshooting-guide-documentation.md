# Troubleshooting Guide

## Overview

This guide provides step-by-step troubleshooting procedures for common issues in the Parker's Foodservice management system. It includes diagnostic steps, resolution procedures, and preventive measures.

## General Troubleshooting Approach

### 1. Initial Assessment
1. **Identify the Problem**:
   - What is the exact error or symptom?
   - When did it start occurring?
   - Who is affected (specific users, all users, certain features)?
   - Are there any error messages or codes?

2. **Gather Information**:
   - Check browser console for JavaScript errors
   - Review application logs
   - Verify network connectivity
   - Check system resource usage

3. **Document Everything**:
   - Record error messages exactly
   - Note steps taken to reproduce the issue
   - Document any temporary workarounds
   - Track resolution attempts

## Authentication Issues

### Problem: Users Cannot Log In

#### Symptoms
- Login page shows "Invalid credentials" error
- Users redirected to login page repeatedly
- Session expires immediately after login

#### Diagnostic Steps
```bash
# Check Supabase authentication service
curl -H "apikey: YOUR_SUPABASE_ANON_KEY" \
     "https://YOUR_PROJECT.supabase.co/auth/v1/settings"

# Check database connection
psql -h YOUR_DB_HOST -p 5432 -U postgres -d YOUR_DATABASE -c "SELECT 1;"
```

```sql
-- Check user accounts
SELECT email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'user@example.com';

-- Check for locked accounts
SELECT * FROM auth.audit_log_entries 
WHERE created_at >= NOW() - INTERVAL '1 hour'
AND ip_address = 'USER_IP_ADDRESS';
```

#### Common Solutions

1. **Password Reset**:
   ```sql
   -- Reset user password (admin only)
   UPDATE auth.users 
   SET encrypted_password = crypt('new_password', gen_salt('bf'))
   WHERE email = 'user@example.com';
   ```

2. **Clear Browser Data**:
   - Clear cookies and local storage
   - Disable browser extensions
   - Try incognito/private mode

3. **Session Issues**:
   ```sql
   -- Clear old sessions
   DELETE FROM auth.sessions 
   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'user@example.com');
   ```

### Problem: Session Expires Too Quickly

#### Symptoms
- Users logged out after short periods
- "Session expired" messages during normal use

#### Solutions
```javascript
// Check session configuration in supabaseClient.js
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
```

## Data Loading Issues

### Problem: Landing Page Not Loading Data

#### Symptoms
- Performance metrics show zeros or "Loading..."
- Staff schedule appears empty
- Weather widget not updating
- Leave requests not displaying

#### Diagnostic Steps
```sql
-- Check daily metrics data
SELECT * FROM daily_metric_review 
WHERE metric_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY metric_date DESC;

-- Check if falling back to daily_metrics
SELECT * FROM daily_metrics 
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;

-- Check employee schedules
SELECT e.name, es.schedule_date, es.shift_start, es.shift_end
FROM employees e
JOIN employee_schedules es ON e.id = es.employee_id
WHERE es.schedule_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
ORDER BY es.schedule_date, e.name;

-- Check leave requests
SELECT e.name, lr.leave_type, lr.start_date, lr.end_date, lr.status
FROM employees e
JOIN leave_requests lr ON e.id = lr.employee_id
WHERE lr.start_date <= CURRENT_DATE + INTERVAL '30 days'
AND lr.end_date >= CURRENT_DATE
AND lr.status = 'approved'
ORDER BY lr.start_date;
```

#### Common Solutions

1. **Missing Daily Metrics**:
   ```sql
   -- Manually insert missing metrics
   INSERT INTO daily_metric_review (
     metric_date, total_sales, total_orders, labor_efficiency,
     amazon_sales, ebay_sales, shopify_sales, other_channel_sales
   ) VALUES (
     CURRENT_DATE - INTERVAL '1 day',
     0, 0, 0, 0, 0, 0, 0
   );
   ```

2. **Schedule Display Issues**:
   - Check day_of_week mapping (Database: 0=Monday, JavaScript: 0=Sunday)
   - Verify is_working flag is set correctly
   - Ensure employee records exist and are active

3. **Weather Widget Issues**:
   ```bash
   # Test weather API
   curl "http://api.weatherapi.com/v1/current.json?key=YOUR_API_KEY&q=YOUR_LOCATION"
   ```

### Problem: Analytics Dashboard Empty or Incorrect

#### Symptoms
- Charts not rendering
- Sales data showing zeros
- "No data available" messages
- Incorrect totals or calculations

#### Diagnostic Steps
```javascript
// Check browser console for errors
console.log('Checking analytics data...');

// Test API endpoints manually
fetch('/api/linnworks/financialData?startDate=2025-07-01&endDate=2025-07-02')
  .then(response => response.json())
  .then(data => console.log('Financial data:', data));

fetch('/api/linnworks/daily-orders?startDate=2025-07-01&endDate=2025-07-02')
  .then(response => response.json())
  .then(data => console.log('Orders data:', data));
```

```sql
-- Check Linnworks integration data
SELECT * FROM linnworks_orders 
WHERE order_date >= CURRENT_DATE - INTERVAL '7 days'
LIMIT 10;

-- Verify sales aggregations
SELECT 
  DATE(order_date) as day,
  SUM(total_value) as total_sales,
  COUNT(*) as order_count
FROM linnworks_orders
WHERE order_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(order_date)
ORDER BY day DESC;
```

#### Common Solutions

1. **API Connection Issues**:
   ```bash
   # Test Linnworks API connectivity
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        "https://api.linnworks.net/api/Orders/GetOrders"
   ```

2. **Chart Rendering Issues**:
   - Clear browser cache
   - Check Chart.js library loading
   - Verify data format matches chart expectations

3. **Data Calculation Errors**:
   ```sql
   -- Recalculate daily metrics
   UPDATE daily_metric_review 
   SET total_sales = amazon_sales + ebay_sales + shopify_sales + other_channel_sales
   WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days';
   ```

## Employee Hours Issues

### Problem: Hours Not Saving

#### Symptoms
- "Save failed" error messages
- Hours reset after page refresh
- Database not updating with new values

#### Diagnostic Steps
```sql
-- Check recent hour entries
SELECT * FROM daily_employee_hours 
WHERE work_date >= CURRENT_DATE - INTERVAL '3 days'
ORDER BY work_date DESC, employee_name;

-- Check for constraint violations
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'daily_employee_hours';

-- Check for duplicate entries
SELECT employee_id, work_date, COUNT(*) 
FROM daily_employee_hours 
GROUP BY employee_id, work_date 
HAVING COUNT(*) > 1;
```

#### Common Solutions

1. **Validation Errors**:
   ```javascript
   // Check hour validation in the frontend
   function validateHours(hours) {
     return hours >= 0 && hours <= 24 && hours % 0.5 === 0;
   }
   ```

2. **Database Conflicts**:
   ```sql
   -- Remove duplicate entries
   DELETE FROM daily_employee_hours 
   WHERE id NOT IN (
     SELECT MIN(id) 
     FROM daily_employee_hours 
     GROUP BY employee_id, work_date
   );
   ```

3. **Permission Issues**:
   ```sql
   -- Check RLS policies
   SELECT * FROM pg_policies 
   WHERE tablename = 'daily_employee_hours';
   ```

### Problem: Employees Not Appearing in Hours List

#### Symptoms
- Missing employees from the hours entry page
- Empty employee list
- Some employees visible, others missing

#### Diagnostic Steps
```sql
-- Check all employees
SELECT id, name, role, created_at 
FROM employees 
ORDER BY name;

-- Check employee service query
SELECT id, name, role 
FROM employees 
WHERE active = true OR active IS NULL
ORDER BY name;
```

#### Solutions
```sql
-- Ensure all employees are active
UPDATE employees 
SET active = true 
WHERE active IS NULL OR active = false;

-- Check for employees without roles
UPDATE employees 
SET role = 'Associate' 
WHERE role IS NULL OR role = '';
```

## Schedule Management Issues

### Problem: Calendar Not Displaying Schedules

#### Symptoms
- Empty calendar view
- Schedules not appearing on correct dates
- Wrong employees showing on shifts

#### Diagnostic Steps
```sql
-- Check schedule data for current week
SELECT 
  e.name,
  es.schedule_date,
  es.shift_start,
  es.shift_end,
  es.is_working
FROM employees e
JOIN employee_schedules es ON e.id = es.employee_id
WHERE es.schedule_date BETWEEN 
  DATE_TRUNC('week', CURRENT_DATE) AND 
  DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '6 days'
ORDER BY es.schedule_date, e.name;

-- Check day_of_week calculations
SELECT 
  schedule_date,
  EXTRACT(DOW FROM schedule_date) as js_dow,
  CASE 
    WHEN EXTRACT(DOW FROM schedule_date) = 0 THEN 6
    ELSE EXTRACT(DOW FROM schedule_date) - 1
  END as db_dow
FROM employee_schedules
WHERE schedule_date >= CURRENT_DATE
LIMIT 10;
```

#### Common Solutions

1. **Date Mapping Issues**:
   ```javascript
   // Fix day-of-week conversion
   function jsToDbDayOfWeek(jsDay) {
     return jsDay === 0 ? 6 : jsDay - 1;
   }
   
   function dbToJsDayOfWeek(dbDay) {
     return dbDay === 6 ? 0 : dbDay + 1;
   }
   ```

2. **Missing Schedule Patterns**:
   ```sql
   -- Generate schedules from patterns
   INSERT INTO employee_schedules (employee_id, schedule_date, shift_start, shift_end, is_working)
   SELECT 
     sp.employee_id,
     generate_series(
       CURRENT_DATE,
       CURRENT_DATE + INTERVAL '14 days',
       '1 day'::interval
     )::date as schedule_date,
     sp.shift_start,
     sp.shift_end,
     sp.is_working
   FROM schedule_patterns sp
   WHERE sp.day_of_week = EXTRACT(DOW FROM generate_series(
     CURRENT_DATE,
     CURRENT_DATE + INTERVAL '14 days',
     '1 day'::interval
   ))
   ON CONFLICT (employee_id, schedule_date) DO NOTHING;
   ```

### Problem: Leave Requests Not Working

#### Symptoms
- Cannot submit leave requests
- Leave not showing on calendar
- Approved leave not blocking schedules

#### Diagnostic Steps
```sql
-- Check leave request data
SELECT 
  e.name,
  lr.leave_type,
  lr.start_date,
  lr.end_date,
  lr.status,
  lr.created_at
FROM employees e
JOIN leave_requests lr ON e.id = lr.employee_id
ORDER BY lr.created_at DESC
LIMIT 20;

-- Check for conflicts
SELECT es.*, lr.leave_type
FROM employee_schedules es
JOIN leave_requests lr ON es.employee_id = lr.employee_id
WHERE es.schedule_date BETWEEN lr.start_date AND lr.end_date
AND lr.status = 'approved'
AND es.is_working = true;
```

#### Solutions
```sql
-- Auto-approve emergency leave (if business rule)
UPDATE leave_requests 
SET status = 'approved'
WHERE leave_type = 'Emergency Leave' 
AND status = 'pending';

-- Update schedules for approved leave
UPDATE employee_schedules 
SET is_working = false
WHERE employee_id IN (
  SELECT employee_id FROM leave_requests 
  WHERE status = 'approved'
  AND schedule_date BETWEEN start_date AND end_date
);
```

## Performance Issues

### Problem: Slow Page Loading

#### Symptoms
- Pages take more than 5 seconds to load
- Database queries timing out
- High CPU/memory usage

#### Diagnostic Steps
```sql
-- Find slow queries
SELECT query, calls, total_time, mean_time, rows
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;

-- Check active connections
SELECT count(*) as active_connections
FROM pg_stat_activity
WHERE state = 'active';

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

```bash
# Check system resources
free -h
df -h
top -n 1 | head -10
```

#### Solutions

1. **Query Optimization**:
   ```sql
   -- Add missing indexes
   CREATE INDEX IF NOT EXISTS idx_daily_hours_date_employee 
   ON daily_employee_hours(work_date, employee_id);
   
   CREATE INDEX IF NOT EXISTS idx_schedules_date_employee 
   ON employee_schedules(schedule_date, employee_id);
   
   -- Update table statistics
   ANALYZE daily_employee_hours;
   ANALYZE employee_schedules;
   ANALYZE daily_metric_review;
   ```

2. **Connection Pooling**:
   ```javascript
   // Optimize Supabase connection
   const supabase = createClient(supabaseUrl, supabaseAnonKey, {
     db: {
       schema: 'public',
     },
     auth: {
       persistSession: true,
     },
     global: {
       headers: { 'x-my-custom-header': 'my-app-name' },
     },
   });
   ```

3. **Data Pagination**:
   ```javascript
   // Implement pagination for large datasets
   async function getEmployeeHours(page = 1, limit = 50) {
     const offset = (page - 1) * limit;
     const { data, error } = await supabase
       .from('daily_employee_hours')
       .select('*')
       .range(offset, offset + limit - 1)
       .order('work_date', { ascending: false });
     
     return { data, error };
   }
   ```

### Problem: High Memory Usage

#### Symptoms
- Server running out of memory
- Application crashes with out-of-memory errors
- Slow response times

#### Diagnostic Steps
```bash
# Check memory usage by process
ps aux --sort=-%mem | head -10

# Check swap usage
swapon --show

# Monitor memory in real-time
watch -n 1 'free -h'
```

#### Solutions
1. **Optimize Queries**:
   ```sql
   -- Limit result sets
   SELECT * FROM large_table 
   WHERE date_column >= CURRENT_DATE - INTERVAL '30 days'
   LIMIT 1000;
   ```

2. **Clear Caches**:
   ```bash
   # Clear system caches
   sync && echo 3 | sudo tee /proc/sys/vm/drop_caches
   
   # Restart services if needed
   sudo systemctl restart nginx
   sudo systemctl restart postgresql
   ```

## Database Issues

### Problem: Database Connection Errors

#### Symptoms
- "Connection refused" errors
- "Too many connections" errors
- Database timeouts

#### Diagnostic Steps
```sql
-- Check current connections
SELECT 
  datname,
  usename,
  application_name,
  client_addr,
  state,
  query_start,
  state_change
FROM pg_stat_activity;

-- Check connection limits
SHOW max_connections;
SELECT count(*) FROM pg_stat_activity;
```

#### Solutions
```sql
-- Kill idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND state_change < NOW() - INTERVAL '1 hour';

-- Increase connection limit (requires restart)
-- In postgresql.conf: max_connections = 200
```

### Problem: Data Inconsistency

#### Symptoms
- Totals don't match detail records
- Missing foreign key relationships
- Duplicate records

#### Diagnostic Steps
```sql
-- Check referential integrity
SELECT 'employee_schedules' as table_name, count(*) as orphaned_records
FROM employee_schedules es
LEFT JOIN employees e ON es.employee_id = e.id
WHERE e.id IS NULL

UNION ALL

SELECT 'daily_employee_hours', count(*)
FROM daily_employee_hours deh
LEFT JOIN employees e ON deh.employee_id = e.id
WHERE e.id IS NULL;

-- Check for duplicates
SELECT 
  employee_id, 
  work_date, 
  count(*) as duplicate_count
FROM daily_employee_hours
GROUP BY employee_id, work_date
HAVING count(*) > 1;
```

#### Solutions
```sql
-- Fix orphaned records
DELETE FROM employee_schedules
WHERE employee_id NOT IN (SELECT id FROM employees);

-- Remove duplicates (keep most recent)
DELETE FROM daily_employee_hours
WHERE id NOT IN (
  SELECT DISTINCT ON (employee_id, work_date) id
  FROM daily_employee_hours
  ORDER BY employee_id, work_date, updated_at DESC
);

-- Add constraints to prevent future issues
ALTER TABLE daily_employee_hours
ADD CONSTRAINT unique_employee_date UNIQUE (employee_id, work_date);
```

## Network and API Issues

### Problem: External API Failures

#### Symptoms
- Weather data not updating
- Linnworks data not syncing
- "API timeout" errors

#### Diagnostic Steps
```bash
# Test external API connectivity
curl -v "http://api.weatherapi.com/v1/current.json?key=YOUR_KEY&q=London"

# Test Linnworks API
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://api.linnworks.net/api/Inventory/GetInventoryItems"

# Check DNS resolution
nslookup api.weatherapi.com
nslookup api.linnworks.net
```

#### Solutions
1. **API Key Issues**:
   ```javascript
   // Verify API keys are correctly configured
   const weatherApiKey = process.env.WEATHER_API_KEY;
   const linnworksToken = process.env.LINNWORKS_TOKEN;
   
   if (!weatherApiKey || !linnworksToken) {
     throw new Error('Missing API credentials');
   }
   ```

2. **Rate Limiting**:
   ```javascript
   // Implement retry logic with exponential backoff
   async function apiCallWithRetry(apiCall, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await apiCall();
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
       }
     }
   }
   ```

3. **Fallback Strategies**:
   ```javascript
   // Use cached data when API fails
   async function getWeatherData() {
     try {
       const response = await fetch(weatherApiUrl);
       const data = await response.json();
       // Cache successful response
       localStorage.setItem('weatherCache', JSON.stringify({
         data,
         timestamp: Date.now()
       }));
       return data;
     } catch (error) {
       // Use cached data if available and recent
       const cached = localStorage.getItem('weatherCache');
       if (cached) {
         const { data, timestamp } = JSON.parse(cached);
         if (Date.now() - timestamp < 3600000) { // 1 hour
           return data;
         }
       }
       throw error;
     }
   }
   ```

## Browser and Frontend Issues

### Problem: JavaScript Errors

#### Symptoms
- Page functionality not working
- Console showing error messages
- Forms not submitting

#### Diagnostic Steps
```javascript
// Check for common errors in browser console
console.log('Checking for errors...');

// Verify dependencies are loaded
console.log('Svelte loaded:', typeof window.Svelte !== 'undefined');
console.log('Chart.js loaded:', typeof window.Chart !== 'undefined');

// Check local storage
console.log('Local storage:', localStorage);
console.log('Session storage:', sessionStorage);
```

#### Solutions
1. **Clear Browser Data**:
   - Clear cookies and local storage
   - Hard refresh (Ctrl+F5 or Cmd+Shift+R)
   - Disable browser extensions

2. **Version Conflicts**:
   ```bash
   # Update dependencies
   npm update
   
   # Clear node modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **CORS Issues**:
   ```javascript
   // Check CORS headers in server response
   fetch('/api/test')
     .then(response => {
       console.log('CORS headers:', response.headers.get('Access-Control-Allow-Origin'));
       return response.json();
     });
   ```

### Problem: Mobile Display Issues

#### Symptoms
- Layout broken on mobile devices
- Touch events not working
- Text too small or overlapping

#### Solutions
```css
/* Add responsive meta tag */
<meta name="viewport" content="width=device-width, initial-scale=1.0">

/* Fix mobile-specific styles */
@media (max-width: 768px) {
  .container {
    padding: 16px;
  }
  
  .table {
    font-size: 14px;
    overflow-x: auto;
  }
  
  .button {
    padding: 12px 16px;
    font-size: 16px; /* Prevent zoom on iOS */
  }
}
```

## Emergency Escalation Procedures

### Level 1: User Support Issues
- **Response Time**: 4 hours during business hours
- **Responsible**: System Administrator
- **Examples**: Login issues, data entry problems, minor display issues

### Level 2: System Performance Issues
- **Response Time**: 2 hours during business hours, 4 hours after hours
- **Responsible**: System Administrator + Operations Manager
- **Examples**: Slow loading, partial outages, data sync issues

### Level 3: Critical System Failure
- **Response Time**: 30 minutes, 24/7
- **Responsible**: All technical staff + Management
- **Examples**: Complete system outage, data corruption, security breaches

### Contact Information
```
Primary: System Administrator - phone/email
Secondary: Operations Manager - phone/email
Emergency: Management Team - phone/email

External Support:
- Supabase Support: support@supabase.io
- Hosting Provider: [contact details]
- ISP: [contact details]
```

## Prevention Strategies

### 1. Monitoring and Alerting
- Set up automated monitoring for all critical systems
- Configure alerts for performance thresholds
- Regular health checks and status reports

### 2. Regular Maintenance
- Follow the maintenance guide schedule
- Keep all software updated
- Regular backup testing

### 3. User Training
- Provide training on common procedures
- Document known workarounds
- Create user guides for complex features

### 4. Change Management
- Test all changes in staging environment
- Have rollback procedures ready
- Document all system changes

This troubleshooting guide should be updated regularly based on new issues encountered and solutions discovered.
