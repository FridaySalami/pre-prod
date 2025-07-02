#!/bin/bash

# Test script for AI Assistant Function Calling

echo "Testing AI Assistant Function Calling API..."

# Test data (simulated analytics data)
TEST_DATA='{
  "message": "Calculate the growth rate for total sales this month",
  "analyticsData": {
    "dailyData": [
      {"date": "2025-06-01", "total_sales": 1200, "amazon_sales": 600, "ebay_sales": 400, "shopify_sales": 200, "linnworks_total_orders": 45, "labor_efficiency": 12.5},
      {"date": "2025-06-02", "total_sales": 1350, "amazon_sales": 650, "ebay_sales": 450, "shopify_sales": 250, "linnworks_total_orders": 48, "labor_efficiency": 13.2},
      {"date": "2025-06-03", "total_sales": 980, "amazon_sales": 500, "ebay_sales": 300, "shopify_sales": 180, "linnworks_total_orders": 38, "labor_efficiency": 11.8}
    ],
    "monthlyData": [
      {"totalSales": 3530, "totalOrders": 131, "laborEfficiency": 12.5, "averageOrderValue": 26.95}
    ],
    "selectedPeriod": {"year": 2025, "month": 6, "monthName": "June 2025"},
    "summary": {
      "totalDays": 3,
      "hasData": true,
      "avgDailySales": 1176.67,
      "avgDailyOrders": 43.67,
      "avgLaborEfficiency": 12.5
    }
  }
}'

echo "Sending test request to AI Assistant API..."

# Test the function calling endpoint
curl -X POST http://localhost:3001/api/assistant \
  -H "Content-Type: application/json" \
  -d "$TEST_DATA" \
  -w "\n\nHTTP Status: %{http_code}\n" \
  -s

echo -e "\n\nTest completed!"
echo "Check the response above to see if function calling worked."
echo "Look for 'functionCalls' in the response JSON."
