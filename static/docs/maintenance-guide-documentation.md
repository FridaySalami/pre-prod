# System Maintenance Guide

## Overview

This guide provides comprehensive maintenance procedures for the Parker's Foodservice management system. Regular maintenance ensures optimal performance, data integrity, and system reliability across all components.

## Daily Maintenance Tasks

### 1. Data Validation & Integrity

#### Morning Checklist (9:00 AM)
```sql
-- Verify yesterday's metrics are populated
SELECT metric_date, total_sales, total_orders 
FROM daily_metric_review 
WHERE metric_date = CURRENT_DATE - 1;

-- Check for missing employee hour records
SELECT COUNT(*) as missing_hours
FROM employees e
LEFT JOIN daily_employee_hours deh ON e.id = deh.employee_id 
    AND deh.work_date = CURRENT_DATE - 1
WHERE deh.id IS NULL AND e.created_at < CURRENT_DATE - 1;

-- Validate schedule integrity
SELECT COUNT(*) as schedule_conflicts
FROM employee_schedules es1
JOIN employee_schedules es2 ON es1.employee_id = es2.employee_id
    AND es1.schedule_date = es2.schedule_date
    AND es1.id != es2.id;
```

#### Data Quality Checks
- **Metrics Validation**: Ensure daily_metric_review has data for yesterday
- **Hour Tracking**: Verify all active employees have hour entries
- **Schedule Conflicts**: Check for overlapping schedules
- **Leave Request Status**: Review pending leave requests

### 2. System Performance Monitoring

#### Database Performance
```sql
-- Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE mean_time > 1000  -- queries taking > 1 second
ORDER BY total_time DESC
LIMIT 10;

-- Monitor table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;
```

#### Application Health
- Check error logs in `/var/log/app/` or application monitoring
- Monitor API response times for key endpoints
- Verify external API connections (Linnworks, Weather)
- Check memory and CPU usage

### 3. Backup Verification

#### Database Backups
```bash
# Verify today's backup exists
ls -la /backups/database/$(date +%Y-%m-%d)*

# Test backup integrity
pg_dump --username=backup_user --host=backup_host --dbname=backup_db --verbose --file=/tmp/test_backup.sql

# Verify backup size is reasonable
du -h /backups/database/$(date +%Y-%m-%d)*
```

#### File System Backups
- Verify application code backups
- Check static file backups (documentation, uploads)
- Validate configuration backups

## Weekly Maintenance Tasks

### 1. Data Cleanup & Archiving

#### Employee Data Cleanup
```sql
-- Archive old leave requests (older than 1 year)
UPDATE leave_requests 
SET archived = true 
WHERE status IN ('approved', 'completed', 'rejected')
    AND end_date < CURRENT_DATE - INTERVAL '1 year'
    AND archived = false;

-- Clean up orphaned schedule records
DELETE FROM employee_schedules 
WHERE employee_id NOT IN (SELECT id FROM employees);

-- Remove duplicate schedule entries
WITH duplicates AS (
    SELECT id, ROW_NUMBER() OVER (
        PARTITION BY employee_id, schedule_date, shift_start, shift_end 
        ORDER BY created_at DESC
    ) as rn
    FROM employee_schedules
)
DELETE FROM employee_schedules 
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);
```

#### Metrics Data Management
```sql
-- Archive old daily metrics (keep 2 years)
DELETE FROM daily_metrics 
WHERE date < CURRENT_DATE - INTERVAL '2 years';

-- Compress historical sales data (keep detailed data for 6 months)
INSERT INTO historical_sales_summary (
    week_ending, channel, total_sales, total_orders, avg_order_value
)
SELECT 
    DATE_TRUNC('week', sales_date) + INTERVAL '6 days' as week_ending,
    channel,
    SUM(sales_amount) as total_sales,
    SUM(order_count) as total_orders,
    AVG(sales_amount / NULLIF(order_count, 0)) as avg_order_value
FROM historical_sales_data
WHERE sales_date < CURRENT_DATE - INTERVAL '6 months'
    AND sales_date >= CURRENT_DATE - INTERVAL '2 years'
GROUP BY DATE_TRUNC('week', sales_date), channel;

-- Remove detailed data after summarization
DELETE FROM historical_sales_data 
WHERE sales_date < CURRENT_DATE - INTERVAL '6 months';
```

### 2. Performance Optimization

#### Database Maintenance
```sql
-- Update table statistics
ANALYZE;

-- Rebuild indexes if needed
REINDEX DATABASE production_db;

-- Check for unused indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read
FROM pg_stat_user_indexes 
WHERE idx_scan = 0
ORDER BY tablename;

-- Vacuum tables to reclaim space
VACUUM ANALYZE employees;
VACUUM ANALYZE daily_employee_hours;
VACUUM ANALYZE employee_schedules;
VACUUM ANALYZE daily_metric_review;
```

#### Application Performance
- Clear application caches
- Restart background services if needed
- Update search indexes
- Optimize image and static file compression

### 3. Security Updates

#### Access Review
```sql
-- Review user access patterns
SELECT 
    auth.users.email,
    COUNT(*) as session_count,
    MAX(auth.sessions.created_at) as last_login
FROM auth.users
LEFT JOIN auth.sessions ON auth.users.id = auth.sessions.user_id
WHERE auth.sessions.created_at > CURRENT_DATE - INTERVAL '30 days'
GROUP BY auth.users.email
ORDER BY last_login DESC;

-- Check for inactive users
SELECT email, created_at, last_sign_in_at
FROM auth.users
WHERE last_sign_in_at < CURRENT_DATE - INTERVAL '90 days'
    OR last_sign_in_at IS NULL;
```

#### Security Patches
- Update system packages
- Review and apply security updates
- Check SSL certificate expiration
- Audit firewall rules
**Responsible**: HR Manager  
**Frequency**: Daily at 4:00 PM

1. **Check Previous Day's Hours** (`/employee-hours`)
2. **Verify Completeness**:
   - All scheduled employees have hour entries
   - No obviously incorrect values (>24 hours, negative values)
   - Role-based totals match expected staffing levels

3. **Data Quality Checks**:
   ```sql
   -- Find employees with excessive hours
   SELECT employee_name, hours_worked, work_date
   FROM daily_employee_hours
   WHERE hours_worked > 12 
   AND work_date >= CURRENT_DATE - INTERVAL '7 days';
   
   -- Find missing hour entries for scheduled employees
   SELECT e.name, es.schedule_date
   FROM employees e
   JOIN employee_schedules es ON e.id = es.employee_id
   LEFT JOIN daily_employee_hours deh ON e.id = deh.employee_id 
     AND es.schedule_date = deh.work_date
   WHERE es.schedule_date = CURRENT_DATE - INTERVAL '1 day'
   AND es.is_working = true
   AND deh.id IS NULL;
   ```

### 2. Schedule Management

#### Schedule Consistency Check
**Responsible**: Operations Manager  
**Frequency**: Daily at 11:00 AM

1. **Review Today's Schedule** (`/schedules`)
2. **Check for Issues**:
   - Staffing gaps during business hours
   - Overlapping shifts for same employee
   - Conflicts with approved leave requests

3. **Resolve Conflicts**:
   ```sql
   -- Find scheduling conflicts with leave
   SELECT es.*, lr.leave_type
   FROM employee_schedules es
   JOIN leave_requests lr ON es.employee_id = lr.employee_id
   WHERE es.schedule_date BETWEEN lr.start_date AND lr.end_date
   AND lr.status = 'approved'
   AND es.is_working = true
   AND es.schedule_date >= CURRENT_DATE;
   ```

## Weekly Maintenance Tasks

### 1. Database Maintenance

#### Every Monday (8:00 AM)
**Responsible**: System Administrator

##### Database Performance Check
```sql
-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE idx_scan = 0;

-- Identify slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

##### Data Cleanup
```sql
-- Archive old metrics (keep 2 years)
DELETE FROM daily_metrics 
WHERE date < CURRENT_DATE - INTERVAL '2 years';

-- Clean up old leave requests
UPDATE leave_requests 
SET archived = true 
WHERE status IN ('approved', 'completed') 
AND end_date < CURRENT_DATE - INTERVAL '1 year'
AND archived IS NOT TRUE;

-- Remove orphaned schedules
DELETE FROM employee_schedules 
WHERE employee_id NOT IN (SELECT id FROM employees);
```

##### Backup Verification
```bash
# Verify daily backups exist and are valid
ls -la /backup/daily/ | grep $(date -d "yesterday" +%Y-%m-%d)

# Test backup integrity
pg_dump --schema-only your_database > schema_test.sql
psql -d test_restore < schema_test.sql
```

### 2. Application Maintenance

#### System Health Check
**Responsible**: System Administrator  
**Frequency**: Every Tuesday (9:00 AM)

1. **Performance Monitoring**:
   ```bash
   # Check memory usage
   free -h
   
   # Check disk space
   df -h
   
   # Check CPU usage
   top -n 1 | head -5
   
   # Check application logs
   tail -n 100 /var/log/nginx/access.log
   tail -n 100 /var/log/nginx/error.log
   ```

2. **Application Updates**:
   ```bash
   # Check for Node.js security updates
   npm audit
   
   # Update dependencies if needed
   npm update
   
   # Check Svelte/SvelteKit versions
   npm outdated
   ```

3. **Security Updates**:
   ```bash
   # Update system packages
   sudo apt update && sudo apt upgrade
   
   # Check for security vulnerabilities
   npm audit --audit-level=moderate
   ```

### 3. Data Validation

#### Weekly Data Integrity Check
**Responsible**: Data Manager  
**Frequency**: Every Wednesday (10:00 AM)

1. **Employee Data Validation**:
   ```sql
   -- Check for duplicate employees
   SELECT name, COUNT(*) 
   FROM employees 
   GROUP BY name 
   HAVING COUNT(*) > 1;
   
   -- Verify all employees have roles
   SELECT name FROM employees WHERE role IS NULL OR role = '';
   
   -- Check for inactive employees with recent schedules
   SELECT e.name, MAX(es.schedule_date)
   FROM employees e
   JOIN employee_schedules es ON e.id = es.employee_id
   WHERE e.is_active = false
   AND es.schedule_date >= CURRENT_DATE - INTERVAL '30 days'
   GROUP BY e.name;
   ```

2. **Financial Data Validation**:
   ```sql
   -- Check for missing daily metrics
   SELECT generate_series(
     CURRENT_DATE - INTERVAL '30 days',
     CURRENT_DATE - INTERVAL '1 day',
     '1 day'::interval
   )::date AS missing_date
   EXCEPT
   SELECT metric_date FROM daily_metric_review
   WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days';
   
   -- Verify sales data consistency
   SELECT metric_date, total_sales,
          (amazon_sales + ebay_sales + shopify_sales + other_channel_sales) AS calculated_total
   FROM daily_metric_review
   WHERE ABS(total_sales - (amazon_sales + ebay_sales + shopify_sales + other_channel_sales)) > 0.01
   AND metric_date >= CURRENT_DATE - INTERVAL '7 days';
   ```

## Monthly Maintenance Tasks

### 1. Comprehensive System Review

#### First Monday of Each Month
**Responsible**: System Administrator & Operations Manager

##### Performance Analysis
```sql
-- Monthly sales performance
SELECT 
    DATE_TRUNC('month', metric_date) as month,
    SUM(total_sales) as monthly_sales,
    SUM(total_orders) as monthly_orders,
    AVG(labor_efficiency) as avg_efficiency
FROM daily_metric_review
WHERE metric_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', metric_date)
ORDER BY month DESC;

-- Employee productivity analysis
SELECT 
    employee_role,
    AVG(hours_worked) as avg_daily_hours,
    COUNT(DISTINCT work_date) as days_worked,
    COUNT(DISTINCT employee_id) as employee_count
FROM daily_employee_hours
WHERE work_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
GROUP BY employee_role;
```

##### System Optimization
```sql
-- Reindex heavily used tables
REINDEX TABLE daily_metric_review;
REINDEX TABLE daily_employee_hours;
REINDEX TABLE employee_schedules;

-- Update table statistics
ANALYZE employees;
ANALYZE daily_metric_review;
ANALYZE daily_employee_hours;
ANALYZE employee_schedules;
```

##### Security Review
```bash
# Review user access logs
sudo grep "authentication" /var/log/auth.log | tail -50

# Check SSL certificate expiration
openssl x509 -in /etc/ssl/certs/your-cert.pem -text -noout | grep "Not After"

# Review Supabase security settings
# - Row Level Security policies
# - API key rotation schedule
# - User permissions audit
```

### 2. Data Archival and Cleanup

#### Monthly Data Management
**Responsible**: Data Manager  
**Frequency**: Last Friday of each month

1. **Archive Old Data**:
   ```sql
   -- Archive metrics older than 2 years
   CREATE TABLE IF NOT EXISTS daily_metric_review_archive AS
   SELECT * FROM daily_metric_review WHERE 1=0;
   
   INSERT INTO daily_metric_review_archive
   SELECT * FROM daily_metric_review
   WHERE metric_date < CURRENT_DATE - INTERVAL '2 years';
   
   DELETE FROM daily_metric_review
   WHERE metric_date < CURRENT_DATE - INTERVAL '2 years';
   
   -- Archive employee hours older than 1 year
   CREATE TABLE IF NOT EXISTS daily_employee_hours_archive AS
   SELECT * FROM daily_employee_hours WHERE 1=0;
   
   INSERT INTO daily_employee_hours_archive
   SELECT * FROM daily_employee_hours
   WHERE work_date < CURRENT_DATE - INTERVAL '1 year';
   
   DELETE FROM daily_employee_hours
   WHERE work_date < CURRENT_DATE - INTERVAL '1 year';
   ```

2. **Cleanup Temporary Data**:
   ```sql
   -- Remove old session data
   DELETE FROM auth.sessions 
   WHERE expires_at < NOW() - INTERVAL '30 days';
   
   -- Clean up old audit logs
   DELETE FROM audit_logs 
   WHERE created_at < CURRENT_DATE - INTERVAL '6 months';
   ```

## Quarterly Maintenance Tasks

### 1. Comprehensive System Audit

#### Every Quarter (First Week)
**Responsible**: System Administrator & Management Team

##### Performance Review
- Analyze system performance trends
- Review capacity planning needs
- Assess user satisfaction and feedback
- Plan infrastructure upgrades if needed

##### Security Audit
- Review all user accounts and permissions
- Audit database access patterns
- Review API usage and rate limiting
- Update security policies and procedures

##### Backup and Recovery Testing
```bash
# Full backup restore test
pg_dump production_db > quarterly_test_backup.sql
createdb test_restore_db
psql test_restore_db < quarterly_test_backup.sql

# Verify data integrity
psql test_restore_db -c "SELECT COUNT(*) FROM employees;"
psql test_restore_db -c "SELECT COUNT(*) FROM daily_metric_review;"
```

## Emergency Procedures

### 1. System Outage Response

#### Immediate Actions (0-15 minutes)
1. **Assess the Situation**:
   - Check system status dashboard
   - Verify network connectivity
   - Check server resource usage

2. **Communication**:
   - Notify stakeholders via emergency contact list
   - Update status page if available
   - Document outage start time

3. **Initial Diagnostics**:
   ```bash
   # Check critical services
   systemctl status nginx
   systemctl status postgresql
   
   # Check disk space
   df -h
   
   # Check memory usage
   free -h
   
   # Check system logs
   journalctl -xe --since "5 minutes ago"
   ```

#### Recovery Actions (15-60 minutes)
1. **Service Recovery**:
   ```bash
   # Restart services if needed
   sudo systemctl restart nginx
   sudo systemctl restart postgresql
   
   # Check application logs
   tail -f /var/log/nginx/error.log
   ```

2. **Database Recovery**:
   ```bash
   # If database corruption suspected
   sudo -u postgres pg_dump database_name > emergency_backup.sql
   
   # Restore from latest backup if needed
   sudo -u postgres pg_restore -d database_name latest_backup.dump
   ```

### 2. Data Corruption Response

#### Immediate Assessment
```sql
-- Check table integrity
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public';

-- Verify critical data
SELECT COUNT(*) FROM employees;
SELECT COUNT(*) FROM daily_metric_review WHERE metric_date >= CURRENT_DATE - INTERVAL '7 days';
SELECT COUNT(*) FROM daily_employee_hours WHERE work_date >= CURRENT_DATE - INTERVAL '7 days';
```

#### Recovery Procedures
1. **Isolate the Problem**:
   - Identify affected tables/data
   - Determine corruption scope
   - Stop any processes that might worsen the issue

2. **Restore from Backup**:
   ```bash
   # Restore specific table
   pg_restore -t table_name latest_backup.dump
   
   # Or restore entire database
   dropdb corrupted_database
   createdb new_database
   pg_restore -d new_database latest_backup.dump
   ```

## Monitoring and Alerting

### 1. Automated Monitoring Setup

#### Key Metrics to Monitor
- **System Resources**: CPU, Memory, Disk usage
- **Database Performance**: Query response times, connection count
- **Application Performance**: Page load times, error rates
- **Data Quality**: Missing daily metrics, incomplete hour entries

#### Alert Thresholds
```yaml
# Example monitoring configuration
alerts:
  disk_usage:
    threshold: 85%
    action: email_admin
  
  database_connections:
    threshold: 80%
    action: scale_up
  
  missing_daily_metrics:
    threshold: 1_day
    action: notify_operations
  
  application_errors:
    threshold: 10_per_hour
    action: immediate_notification
```

### 2. Health Check Endpoints

#### Application Health Check
```javascript
// /api/health endpoint
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    external_apis: await checkExternalAPIs(),
    data_freshness: await checkDataFreshness()
  };
  
  const healthy = Object.values(checks).every(check => check.status === 'healthy');
  
  return new Response(JSON.stringify({
    status: healthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString()
  }));
}
```

## Documentation Updates

### 1. Maintenance Log
Keep a detailed log of all maintenance activities:

```markdown
## Maintenance Log

### 2025-07-02 - Weekly Database Maintenance
- Performed: Database cleanup, index optimization
- Duration: 45 minutes
- Issues: None
- Next action: Monitor performance

### 2025-07-01 - Daily Metrics Check
- Performed: Verified yesterday's metrics
- Issues: Missing eBay sales data
- Resolution: Manually updated from Linnworks
- Follow-up: Check eBay API integration
```

### 2. Update Procedures Documentation
- Review and update maintenance procedures quarterly
- Incorporate lessons learned from incidents
- Update contact information and escalation procedures
- Test emergency procedures annually

## Best Practices

### 1. Preventive Maintenance
- **Regular Updates**: Keep all systems and dependencies current
- **Monitoring**: Implement comprehensive monitoring and alerting
- **Testing**: Regularly test backup and recovery procedures
- **Documentation**: Keep all documentation current and accessible

### 2. Change Management
- **Version Control**: All changes go through version control
- **Testing**: Test changes in staging environment first
- **Rollback Plan**: Always have a rollback plan for changes
- **Communication**: Notify stakeholders of planned maintenance

### 3. Security Maintenance
- **Regular Audits**: Conduct security audits quarterly
- **Access Review**: Review user access permissions monthly
- **Updates**: Apply security updates promptly
- **Backup Security**: Ensure backups are encrypted and secure

This maintenance guide should be reviewed and updated quarterly to ensure it remains current with system changes and operational needs.
