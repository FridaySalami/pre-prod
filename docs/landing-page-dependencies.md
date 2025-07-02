# Landing Page Dependency Components Documentation Plan

## Overview

The landing page is the central dashboard that aggregates data from multiple sources and provides navigation to specialized management pages. This document outlines the dependent components and pages that require documentation to maintain the complete system.

## Dependency Matrix

### Core Infrastructure Components

| Component | Location | Purpose | Documentation Priority |
|-----------|----------|---------|----------------------|
| **Session Store** | `src/lib/sessionStore.ts` | User authentication state management | HIGH |
| **Supabase Client** | `src/lib/supabaseClient.ts` | Database connection and authentication | HIGH |
| **Employee Hours Service** | `src/lib/employeeHoursService.ts` | Employee hours data management | MEDIUM |
| **ShadCN Components** | `src/lib/shadcn/components/` | UI component library | LOW |

### Data Source Pages (Update Dependencies)

| Page | Route | Data Tables Updated | Update Frequency | Documentation Priority |
|------|-------|-------------------|------------------|----------------------|
| **Schedule Management** | `/schedules` | `schedules`, `employee_schedules`, `leave_requests` | Real-time | HIGH |
| **Employee Hours** | `/employee-hours` | `employee_hours`, `scheduled_hours` | Daily | HIGH |
| **Analytics Dashboard** | `/dashboard` | `daily_metrics`, `daily_metric_review` | Daily | MEDIUM |
| **Analytics Monthly** | `/analytics/monthly` | `daily_metric_review` (aggregated) | Monthly | MEDIUM |

### Administrative Pages

| Page | Route | Purpose | Documentation Priority |
|------|-------|---------|----------------------|
| **Employee Management** | `/employees` (implied) | Employee master data | HIGH |
| **Profile/Account Settings** | `/profile`, `/account-settings` | User management | LOW |
| **Login/Authentication** | `/login`, `/set-password` | Authentication flow | MEDIUM |

## Documentation Requirements by Component

### 1. Schedule Management Page (`/schedules`) - HIGH PRIORITY
**Status**: ✅ Already documented
- **File**: `/docs/schedule-page-documentation.md`
- **User Guide**: `/docs/schedule-user-guide.md`
- **Dependencies Updated**: 
  - `schedules` table
  - `employee_schedules` table 
  - `leave_requests` table
  - `employees` table

### 2. Employee Hours Page (`/employee-hours`) - HIGH PRIORITY
**Status**: ⏳ Needs documentation
- **Dependencies Updated**:
  - `employee_hours` table
  - `scheduled_hours` table
  - `daily_employee_hours` table (if exists)
- **Required Documentation**:
  - Page functionality and workflow
  - Data input validation rules
  - Integration with landing page metrics
  - Maintenance procedures

### 3. Analytics Dashboard (`/dashboard`) - MEDIUM PRIORITY
**Status**: ⏳ Needs documentation
- **Dependencies Updated**:
  - `daily_metrics` table
  - `daily_metric_review` table
  - Various analytics tables
- **Required Documentation**:
  - Chart configuration and data sources
  - Metric calculation methodologies
  - Data refresh procedures
  - Troubleshooting guide

### 4. Monthly Analytics (`/analytics/monthly`) - MEDIUM PRIORITY
**Status**: ⏳ Needs documentation
- **Purpose**: Aggregated monthly performance reports
- **Dependencies Updated**: Aggregated data from `daily_metric_review`
- **Required Documentation**:
  - Monthly aggregation logic
  - Report generation procedures
  - Data validation requirements

## Data Flow Architecture

```
External Data Sources → Update Pages → Database Tables → Landing Page Display
```

### Critical Data Flow Paths

#### 1. Staff Scheduling Flow
```
Schedule Management Page → schedules/employee_schedules tables → Landing Page Weekly Staff Display
```

#### 2. Leave Management Flow
```
Schedule Management Page → leave_requests table → Landing Page Upcoming Leave Display
```

#### 3. Performance Metrics Flow
```
Analytics/Data Import → daily_metric_review table → Landing Page Performance Metrics
```

#### 4. Hours Tracking Flow
```
Employee Hours Page → employee_hours/scheduled_hours tables → Analytics Dashboard → daily_metric_review table
```

## Maintenance Dependencies

### Daily Maintenance Tasks
1. **Metrics Data Population**
   - Source: Analytics Dashboard or automated ETL
   - Target: `daily_metric_review` table
   - Landing Page Impact: Performance metrics section

2. **Hours Validation**
   - Source: Employee Hours page
   - Target: `scheduled_hours`, `employee_hours` tables
   - Landing Page Impact: Staff scheduling accuracy

### Weekly Maintenance Tasks
1. **Schedule Planning**
   - Source: Schedule Management page
   - Target: `schedules`, `employee_schedules` tables
   - Landing Page Impact: Weekly staffing display

2. **Leave Approval**
   - Source: Schedule Management page
   - Target: `leave_requests` table
   - Landing Page Impact: Upcoming leave display

## Documentation Priorities

### Phase 1: Critical Dependencies (Week 1)
1. **Employee Hours Page** - Directly impacts landing page metrics
2. **Analytics Dashboard** - Source of daily metrics data
3. **Session Management** - Authentication flow documentation

### Phase 2: Supporting Systems (Week 2)
1. **Monthly Analytics** - Longer-term data trends
2. **Administrative Pages** - User management
3. **Data Import Procedures** - ETL processes

### Phase 3: System Integration (Week 3)
1. **API Documentation** - External integrations (Weather API, etc.)
2. **Database Schema** - Complete table documentation
3. **Deployment & Configuration** - Environment setup

## Template Structure for Each Component

Each documentation file should include:

### 1. Overview Section
- Purpose and functionality
- User roles and permissions
- Integration points with landing page

### 2. Data Management Section
- Database tables affected
- Data validation rules
- Update frequencies and schedules

### 3. User Interface Section
- Page layout and navigation
- Form validation and error handling
- User workflow documentation

### 4. Maintenance Section
- Daily/weekly/monthly procedures
- Troubleshooting common issues
- Data integrity checks

### 5. Integration Section
- Landing page dependencies
- Other system dependencies
- Data flow documentation

## Next Steps

1. **Priority Assessment**: Confirm documentation priorities with stakeholders
2. **Resource Allocation**: Assign documentation tasks to team members
3. **Template Creation**: Develop standardized documentation templates
4. **Review Process**: Establish documentation review and approval workflow
5. **Maintenance Schedule**: Create regular documentation update schedule

## Success Metrics

- **Coverage**: 100% of critical dependencies documented
- **Accuracy**: Documentation matches actual system behavior
- **Usability**: New team members can use documentation for system maintenance
- **Currency**: Documentation updated within 48 hours of system changes
