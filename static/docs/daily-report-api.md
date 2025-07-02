# Daily Report API Documentation

## Overview
This API endpoint provides structured daily business metrics data for automated reporting and integration with Make.com.

## Endpoint
**GET** `/api/daily-report`

## Parameters
- `date` (optional): Date in YYYY-MM-DD format (e.g., "2024-06-09")
- If no date is provided, returns yesterday's data by default

## Usage Examples

### Get yesterday's data (default)
```
GET /api/daily-report
```

### Get specific date
```
GET /api/daily-report?date=2024-06-09
```

## Response Format

```json
{
  "date": "2024-06-09",
  "formattedDate": "Sunday, 9th June 2024",
  
  "fulfillment": {
    "shipmentsPacked": 150,
    "actualHoursWorked": 8.5,
    "laborEfficiency": 17.6,
    "laborUtilization": 85.0
  },
  
  "sales": {
    "totalSales": 2450.50,
    "amazonSales": 1470.30,
    "ebaySales": 588.12,
    "shopifySales": 392.08,
    "amazonSalesPercent": 60.0,
    "ebaySalesPercent": 24.0,
    "shopifySalesPercent": 16.0
  },
  
  "orders": {
    "totalOrders": 45,
    "amazonOrders": 28,
    "ebayOrders": 12,
    "shopifyOrders": 5,
    "amazonOrdersPercent": 62.2,
    "ebayOrdersPercent": 26.7,
    "shopifyOrdersPercent": 11.1
  },
  
  "metrics": {
    "averageOrderValue": 54.46,
    "amazonAOV": 52.51,
    "ebayAOV": 49.01,
    "shopifyAOV": 78.42,
    "shipmentsPerHour": 17.6
  },
  
  "status": {
    "dataComplete": true,
    "hasComprehensiveData": true,
    "lastUpdated": "2024-06-10T06:00:00.000Z"
  }
}
```

## Data Fields Explanation

### Fulfillment Section
- `shipmentsPacked`: Number of orders shipped
- `actualHoursWorked`: Total labor hours worked
- `laborEfficiency`: Shipments per hour rate
- `laborUtilization`: Percentage of scheduled hours actually worked

### Sales Section
- `totalSales`: Total revenue in GBP
- `amazonSales`/`ebaySales`/`shopifySales`: Revenue by channel
- `*SalesPercent`: Percentage breakdown of sales by channel

### Orders Section
- `totalOrders`: Total number of orders
- `amazonOrders`/`ebayOrders`/`shopifyOrders`: Order count by channel
- `*OrdersPercent`: Percentage distribution of orders by channel

### Metrics Section
- `averageOrderValue`: Overall AOV across all channels
- `amazonAOV`/`ebayAOV`/`shopifyAOV`: Average order value by channel
- `shipmentsPerHour`: Labor efficiency metric

### Status Section
- `dataComplete`: Whether comprehensive metrics are available
- `hasComprehensiveData`: Whether data comes from full daily_metric_review table
- `lastUpdated`: When the API response was generated

## Error Responses

### Invalid Date Format
```json
{
  "error": "Invalid date format. Use YYYY-MM-DD format."
}
```

### Database Error
```json
{
  "error": "Database error while fetching metrics data"
}
```

### Internal Server Error
```json
{
  "error": "Internal server error",
  "details": "Error details here"
}
```

## Data Sources
1. **Primary**: `daily_metric_review` table (comprehensive metrics)
2. **Fallback**: `daily_metrics` table (basic fulfillment data only)

If comprehensive data is not available, the API will return basic fulfillment metrics with `dataComplete: false` and `hasComprehensiveData: false`.

## CORS Support
The API includes CORS headers to allow cross-origin requests from Make.com and other automation tools.

## Make.com Integration Notes

### Recommended Schedule
- Set Make.com to call this endpoint at **6:00 AM daily**
- Use no date parameter to automatically get yesterday's data
- Check the `status.dataComplete` field to determine if all metrics are available

### URL for Make.com
```
https://your-domain.com/api/daily-report
```

### Example Make.com HTTP Module Configuration
- **Method**: GET
- **URL**: `https://your-domain.com/api/daily-report`
- **Headers**: `Content-Type: application/json`

### Data Mapping for Email Templates
The response structure is designed to be easily mapped to email templates:

- **Subject**: "Daily Business Review - {formattedDate}"
- **Fulfillment Section**: Use `fulfillment.*` fields
- **Sales Performance**: Use `sales.*` fields with currency formatting
- **Order Analysis**: Use `orders.*` fields with percentage displays
- **Key Metrics**: Use `metrics.*` fields for executive summary

### Conditional Logic
Use `status.hasComprehensiveData` to show different content:
- `true`: Show full business review with all sections
- `false`: Show basic fulfillment report only with note about limited data

## Security Notes
- This endpoint uses server-side Supabase service role for data access
- No authentication is currently required (consider adding API key if needed)
- CORS is enabled for external access

## Testing
You can test the endpoint directly in your browser or with curl:

```bash
curl "https://your-domain.com/api/daily-report"
curl "https://your-domain.com/api/daily-report?date=2024-06-09"
```
