#!/bin/bash

# Make.com Setup Test Script
# Replace YOUR_NETLIFY_URL with your actual Netlify site name

NETLIFY_URL="YOUR_NETLIFY_URL.netlify.app"

echo "🧪 Testing Make.com API Integration"
echo "=================================="
echo ""

echo "1️⃣ Testing GET endpoint (safe - just returns info):"
echo "URL: https://$NETLIFY_URL/api/upload-metric-review"
echo ""

curl -X GET "https://$NETLIFY_URL/api/upload-metric-review" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n" \
  2>/dev/null | jq . 2>/dev/null || echo "Response received (install jq for pretty formatting)"

echo ""
echo "2️⃣ Make.com HTTP Request Settings:"
echo "URL: https://$NETLIFY_URL/api/upload-metric-review"
echo "Method: POST"
echo "Headers: Content-Type: application/json"
echo "Body: {\"weekOffset\": 0}"
echo ""

echo "⚠️  WARNING: The POST request below will actually upload data!"
echo "Only run this when you're ready to test the real upload:"
echo ""
echo "curl -X POST 'https://$NETLIFY_URL/api/upload-metric-review' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"weekOffset\": 0}'"
echo ""

echo "✅ Once this works, use the same settings in Make.com HTTP module"
