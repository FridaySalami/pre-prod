#!/bin/bash

# Backfill Missing Sales Data (Oct 15-17, 2025)
# This script fetches the last 3 days of sales data from Amazon

# Your credentials (hardcoded for simplicity)
FRONTEND_URL="https://operations.chefstorecookbook.com"
CRON_SECRET="c190c473e2996bafa89d02dfc18225cd858a4371f23eaefa588a499d0b5540f1"

echo "🔄 Backfilling Sales Data for Oct 15-17, 2025"
echo "📡 Calling: $FRONTEND_URL/api/cron/backfill-sales-report"
echo "📅 Fetching last 3 days of data"
echo ""
echo "⏳ This will take 15-20 minutes (Amazon needs time to generate the report)..."
echo ""

# Make the request
curl -X POST "$FRONTEND_URL/api/cron/backfill-sales-report" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"days": 3}'

echo ""
echo ""
echo "✅ Request completed! Check the JSON response above."
