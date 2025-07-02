# Troubleshooting Guide
*Parker's Foodservice Management System*

## Common Issues and Solutions

### Authentication Issues

#### User Cannot Log In
**Symptoms:** Login page shows error or redirects back to login repeatedly

**Common Causes:**
- Invalid credentials in Supabase
- Session storage issues
- Browser cookies disabled
- Network connectivity problems

**Resolution Steps:**
1. Verify user exists in Supabase Auth dashboard
2. Clear browser storage and cookies
3. Check network connectivity
4. Verify Supabase project configuration
5. Check browser console for authentication errors

#### Session Expires Frequently
**Symptoms:** User gets logged out unexpectedly

**Resolution:**
- Check Supabase session timeout settings
- Verify token refresh mechanism
- Clear browser storage and re-login

### Landing Page Issues

#### Staff Schedule Not Displaying
**Symptoms:** Schedule section shows empty or incorrect staff assignments

**Common Causes:**
- Day of week mapping mismatch (Database: 0=Monday vs JavaScript: 0=Sunday)
- Missing employee records
- Incorrect `is_working` flag in employee_schedules
- Schedule patterns not properly configured

**Resolution Steps:**
1. Check `employee_schedules` table for correct day_of_week values
2. Verify employee records exist in `employees` table
3. Ensure `is_working` flag is set to `true`
4. Check schedule patterns in `schedule_patterns` table
5. Verify date range calculations in landing page component

#### Performance Metrics Show Zeros
**Symptoms:** Yesterday's metrics display as 0 or don't load

**Common Causes:**
- Missing data in `daily_metric_review` table
- Date format mismatch
- Database query errors
- Fallback to `daily_metrics` not working

**Resolution Steps:**
1. Check if data exists for yesterday's date in `daily_metric_review`
2. Verify date format matches database expectations (YYYY-MM-DD)
3. Test fallback query to `daily_metrics` table
4. Check database connection and query logs
5. Run manual metric update if needed

#### Weather Widget Not Loading
**Symptoms:** Weather section shows loading or error state

**Resolution:**
- Verify WeatherAPI.com API key is valid
- Check API rate limits
- Verify location settings (postcode/coordinates)
- Check network connectivity to external API

### Employee Hours Issues

#### Hours Not Saving
**Symptoms:** Changes made but not persisted after save

**Common Causes:**
- Database connection issues
- Validation errors (hours outside 0-24 range)
- User session expired
- Constraint violations

**Resolution Steps:**
1. Check browser console for error messages
2. Verify hours are within valid range (0-24, 0.5 increments)
3. Ensure user is authenticated
4. Check database connection and constraints
5. Verify `daily_employee_hours` table permissions

#### Employee List Not Loading
**Symptoms:** No employees shown in hours tracking interface

**Resolution:**
- Check `employees` table has records
- Verify database query permissions
- Check for JavaScript errors in browser console
- Ensure proper role assignments

### Schedule Management Issues

#### Calendar Not Displaying Correctly
**Symptoms:** Calendar shows blank or incorrect dates

**Common Causes:**
- Date calculation errors
- Timezone issues
- Missing calendar data
- JavaScript date parsing problems

**Resolution Steps:**
1. Check browser timezone settings
2. Verify date calculations in component logic
3. Clear browser cache and reload
4. Check for JavaScript errors related to date handling

#### Cannot Add/Edit Schedules
**Symptoms:** Schedule forms don't submit or show errors

**Resolution:**
- Verify user permissions in database
- Check form validation rules
- Ensure employee exists before adding schedule
- Check for foreign key constraint violations

### Analytics Dashboard Issues

#### Charts Not Rendering
**Symptoms:** Chart areas show blank or loading indefinitely

**Common Causes:**
- Missing chart library dependencies
- Data format issues
- Large dataset causing performance problems
- Browser compatibility issues

**Resolution Steps:**
1. Check browser console for chart library errors
2. Verify data format matches chart expectations
3. Test with smaller date ranges
4. Update browser or try different browser
5. Check chart library version compatibility

#### Sales Data Not Loading
**Symptoms:** Analytics show no data or incorrect values

**Resolution:**
- Verify Linnworks API connection
- Check date range selections
- Ensure `daily_metrics` and `daily_metric_review` tables have data
- Test API endpoints manually
- Check for data synchronization issues

#### Slow Performance
**Symptoms:** Dashboard takes long time to load or becomes unresponsive

**Resolution:**
- Reduce date range being queried
- Check database query performance
- Clear browser cache
- Optimize database indexes if needed
- Consider pagination for large datasets

### Database Issues

#### Connection Timeouts
**Symptoms:** Application shows database connection errors

**Resolution:**
1. Check Supabase project status
2. Verify database connection string
3. Check network connectivity
4. Monitor connection pool usage
5. Consider connection retry logic

#### Slow Query Performance
**Symptoms:** Pages load slowly, timeouts on data operations

**Resolution:**
- Review query execution plans
- Add appropriate database indexes
- Optimize complex joins
- Consider data archiving for old records
- Monitor database resource usage

#### Data Inconsistencies
**Symptoms:** Related data doesn't match between tables

**Resolution:**
- Run data integrity checks
- Verify foreign key constraints
- Check for orphaned records
- Review data entry procedures
- Consider data cleanup scripts

## Performance Optimization

### Browser Performance
- Clear browser cache regularly
- Disable unnecessary browser extensions
- Use modern browser versions
- Monitor memory usage for long sessions

### Database Performance
- Regular maintenance of database statistics
- Monitor slow query logs
- Archive old data periodically
- Optimize frequently used queries

### Network Performance
- Check internet connection stability
- Monitor API response times
- Consider caching strategies
- Optimize payload sizes

## System Monitoring

### Daily Checks
- Verify all main pages load correctly
- Check recent data updates
- Monitor error logs
- Test critical user workflows

### Weekly Checks
- Review database performance metrics
- Check for accumulated errors
- Verify backup procedures
- Test recovery procedures

### Monthly Checks
- Performance trend analysis
- Capacity planning review
- Security audit
- Documentation updates

## Emergency Procedures

### Complete System Outage
1. Check Supabase project status dashboard
2. Verify DNS and domain configuration
3. Check hosting provider status
4. Review recent deployments for issues
5. Implement rollback if necessary

### Data Loss Recovery
1. Stop all write operations immediately
2. Assess scope of data loss
3. Restore from most recent backup
4. Verify data integrity after restore
5. Document incident and lessons learned

### Security Incidents
1. Immediately revoke compromised credentials
2. Review access logs for suspicious activity
3. Update all passwords and API keys
4. Notify relevant stakeholders
5. Implement additional security measures

## Getting Help

### Internal Escalation
1. Check this troubleshooting guide first
2. Review system logs and error messages
3. Document steps to reproduce issue
4. Contact system administrator with details

### External Support
- **Supabase Issues:** Supabase support portal
- **Hosting Issues:** Netlify support
- **API Issues:** Check respective API documentation
- **Browser Issues:** Browser vendor support channels

### Documentation Updates
When resolving new issues:
1. Document the problem and solution
2. Update this troubleshooting guide
3. Consider if system changes are needed
4. Share knowledge with team members

---

## Quick Reference Commands

### Database Queries for Diagnostics
```sql
-- Check recent metric updates
SELECT date, total_sales, total_orders 
FROM daily_metric_review 
ORDER BY date DESC LIMIT 7;

-- Find employees without schedules
SELECT e.name FROM employees e 
LEFT JOIN employee_schedules es ON e.id = es.employee_id 
WHERE es.id IS NULL;

-- Check for data integrity issues
SELECT COUNT(*) as orphaned_schedules 
FROM employee_schedules es 
LEFT JOIN employees e ON es.employee_id = e.id 
WHERE e.id IS NULL;
```

### Browser Console Commands
```javascript
// Check current user session
console.log('Session:', JSON.stringify(userSession));

// Clear local storage
localStorage.clear();

// Check for JavaScript errors
console.log('Errors in console:', console.error.length);
```

This guide should be regularly updated as new issues are discovered and resolved.
