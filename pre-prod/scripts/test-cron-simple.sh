#!/bin/bash

# Simple test script for the daily sales report cron job
# Usage: ./test-cron-simple.sh

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$CRON_SECRET" ]; then
    echo "❌ CRON_SECRET not found in .env file"
    exit 1
fi

API_URL="${TEST_API_URL:-http://localhost:3000}"

echo "🧪 Testing Daily Sales Report Cron Job"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "API URL: $API_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📡 Sending POST request..."
echo ""

curl -X POST "$API_URL/api/cron/daily-sales-report" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -w "\n\n⏱️  Response Time: %{time_total}s\n" \
  -v

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Request complete!"
echo ""
echo "💡 To check the database:"
echo "   SELECT * FROM report_job_logs ORDER BY started_at DESC LIMIT 5;"
echo "   SELECT COUNT(*) FROM amazon_sales_data;"
