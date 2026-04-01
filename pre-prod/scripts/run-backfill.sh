#!/bin/bash

echo "🔄 Starting sales data backfill for 3 days (Oct 15-17, 2025)"
echo "⏳ This will take approximately 15-20 minutes..."
echo "📝 Output will be logged to backfill-output.log"
echo ""

node backfill-sales-data.js 3 2>&1 | tee backfill-output.log

echo ""
echo "✅ Script completed. Check backfill-output.log for details."
