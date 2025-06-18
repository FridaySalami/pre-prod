# Schedule Management User Guide

## Getting Started

Welcome to the Schedule Management system! This guide will help you efficiently manage employee schedules, track working hours, and handle leave requests.

## Quick Start

### Accessing the Schedule
1. Navigate to the Schedules page from the main menu
2. The calendar will load showing the current month
3. You'll see employees scheduled for each day

### Basic Navigation
- **Previous/Next Month**: Use the arrow buttons at the top
- **Calendar Views**: Switch between Calendar View and Manage Schedule Patterns
- **Current Day**: Highlighted with a blue border
- **Weekends**: Saturday and Sunday are visually distinct

## Managing Employees

### Adding New Employees
1. Click the **"Add Employee"** button in the top right
2. Enter the employee's full name
3. Select their role from the dropdown:
   - Manager
   - Supervisor
   - Team Lead
   - Associate
   - Trainee
4. Click **"Add Employee"** to save

### Employee Roles
Employees are automatically sorted by role priority:
1. **Manager** (M) - Highest priority, appears first
2. **Supervisor** (S) - Second priority
3. **Team Lead** (TL) - Third priority
4. **Associate** (A) - Fourth priority
5. **Trainee** (T) - Lowest priority, appears last

## Creating Schedules

### Adding Individual Schedules
1. **Method 1**: Click on any calendar date
2. **Method 2**: Click the **"Add Schedule"** button
3. Fill in the schedule details:
   - **Employee**: Select from the dropdown
   - **Date**: Choose the work date
   - **Shift**: Select the shift time:
     - Morning: 8:00 AM - 4:30 PM
     - Afternoon: 4:00 PM - 12:30 AM
     - Night: 12:00 AM - 8:30 AM
4. Click **"Save Schedule"**

### Working with Shift Times
Each shift is 8.5 hours including paid breaks:
- **Morning Shift**: 08:00 - 16:30 (8.5 hours)
- **Afternoon Shift**: 16:00 - 00:30 (8.5 hours)
- **Night Shift**: 00:00 - 08:30 (8.5 hours)

### Understanding the Calendar Display
- **Employee Names**: Shown on each scheduled day
- **Shift Times**: Displayed next to employee names
- **Working Hours**: Total daily hours shown as a badge (e.g., "17.0h")
- **Employee Count**: Number in the corner shows active employees
- **Status Icons**: ✅ for available, 🌴 for vacation, 🤒 for sick

## Managing Leave Requests

### Adding Leave for Individual Employees
1. Click on an employee's name in the calendar
2. The Employee Leave Modal will open
3. Fill in the leave details:
   - **Leave Type**: Select from available types (Holiday, Sick, etc.)
   - **Start Date**: First day of leave
   - **End Date**: Last day of leave
   - **Notes**: Optional additional information
4. Click **"Save Leave"**

### Bulk Leave Management
For adding leave for multiple employees:
1. Click the **"Bulk Leave"** button
2. Select multiple employees
3. Choose the leave type and date range
4. Apply to all selected employees

### Leave Status Indicators
- **🌴 Holiday/Vacation**: Green background
- **🤒 Sick Leave**: Yellow/orange background
- **Leave Type Colors**: Each leave type has a distinct color

### Filtering Views
Use the **"Show Only Leave"** toggle to:
- View only employees who are on leave
- Hide employees who are working
- Quickly identify coverage gaps

## Weekly Schedule Patterns

### Setting Up Recurring Schedules
1. Click **"Manage Schedule Patterns"** tab
2. Select an employee
3. Set their regular weekly pattern:
   - Check days they normally work
   - Uncheck days they're normally off
4. Save the pattern

### How Patterns Work
- Weekly patterns automatically populate future schedules
- Individual schedule entries override weekly patterns
- Patterns help reduce manual scheduling work
- Changes to patterns affect future dates only

## Understanding Working Hours

### Automatic Hour Calculation
The system automatically calculates:
- **Daily Hours**: Total scheduled hours per day
- **Employee Hours**: Individual employee working time
- **Leave Impact**: Hours are reduced when employees are on leave
- **Hourly Tracking**: Stored in the database for reporting

### Hour Display
- **Calendar Badges**: Show total daily working hours
- **Employee Count**: Active (non-leave) employees per day
- **Running Totals**: Updated in real-time as schedules change

## Advanced Features

### Performance Optimization
The system includes several performance features:
- **Smart Caching**: Reduces load times
- **Preloading**: Adjacent months load in background
- **Optimized Rendering**: Handles large amounts of data efficiently

### Data Validation
All inputs are automatically validated:
- **Employee names**: Must be at least 2 characters
- **Dates**: Must be valid calendar dates
- **Shifts**: Must be from the approved list
- **Leave dates**: End date cannot be before start date

### Error Handling
If something goes wrong:
- **Retry Buttons**: Most errors have retry options
- **Error Messages**: Clear descriptions of what went wrong
- **Automatic Recovery**: System attempts to recover from failures

## Keyboard Shortcuts & Accessibility

### Keyboard Navigation
- **Tab**: Move between interactive elements
- **Enter/Space**: Activate buttons and select dates
- **Escape**: Close modal dialogs
- **Arrow Keys**: Navigate calendar (planned feature)

### Screen Reader Support
The system is fully accessible with:
- **Descriptive Labels**: All elements have clear descriptions
- **Status Announcements**: Changes are announced to screen readers
- **Logical Structure**: Content follows proper heading hierarchy

### Visual Accessibility
- **High Contrast**: Supports high contrast mode
- **Clear Focus**: Visible focus indicators on all interactive elements
- **Color Independence**: Information doesn't rely solely on color

## Tips for Efficient Use

### Daily Workflow
1. **Morning Review**: Check the current day's schedule
2. **Weekly Planning**: Use weekly patterns for regular schedules
3. **Leave Processing**: Handle leave requests promptly
4. **Coverage Checks**: Use "Show Only Leave" to identify gaps

### Best Practices
- **Consistent Naming**: Use full names for employees
- **Regular Patterns**: Set up weekly patterns for regular employees
- **Leave Planning**: Enter known leave dates in advance
- **Regular Reviews**: Check schedules weekly for accuracy

### Troubleshooting
- **Slow Loading**: Refresh the page if data seems slow
- **Missing Data**: Check your internet connection
- **Unexpected Behavior**: Try refreshing or contact support
- **Schedule Conflicts**: The system will warn about overlapping schedules

## Getting Help

### Common Questions

**Q: Can I schedule the same employee for multiple shifts in one day?**
A: The system allows this but will show warnings about potential conflicts.

**Q: What happens to scheduled hours when someone takes leave?**
A: Hours are automatically recalculated to exclude employees on leave.

**Q: Can I delete a schedule once it's created?**
A: Currently, you need to contact an administrator for schedule deletions.

**Q: How far in advance can I schedule?**
A: There's no hard limit, but the system is optimized for scheduling up to 3 months ahead.

### Support Resources
- **In-App Help**: Look for help icons throughout the interface
- **Error Messages**: Read error messages carefully for specific guidance
- **Performance Monitor**: Check browser console for technical details
- **Documentation**: Refer to this user guide for detailed instructions

### Reporting Issues
If you encounter problems:
1. Note the exact steps you were taking
2. Check browser console for error messages
3. Take a screenshot if helpful
4. Report through your organization's support channel

## Updates and New Features

The Schedule Management system is regularly updated with:
- **Performance Improvements**: Faster loading and better responsiveness
- **New Features**: Additional scheduling and reporting capabilities
- **Bug Fixes**: Resolution of reported issues
- **Accessibility Enhancements**: Continued improvement of accessibility features

Stay informed about updates through your organization's communication channels.

---

*Last Updated: June 18, 2025*
*Version: 2.0*
