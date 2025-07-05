#!/bin/bash

# Test all CSV upload clear functions
echo "🧪 Testing all CSV upload clear functions..."
echo ""

# Test Amazon Listings Clear
echo "📦 Testing Amazon Listings Clear:"
curl -X POST "http://localhost:3001/api/amazon-listings" \
  -H "Content-Type: application/json" \
  -d '{"action": "clear"}' \
  -w "\nStatus: %{http_code}\n"
echo ""

# Test Inventory Clear
echo "📋 Testing Inventory Clear:"
curl -X GET "http://localhost:3001/api/inventory?action=clear" \
  -w "\nStatus: %{http_code}\n"
echo ""

# Test Sage Reports Clear
echo "📊 Testing Sage Reports Clear:"
curl -X DELETE "http://localhost:3001/api/sage-reports?action=clear" \
  -w "\nStatus: %{http_code}\n"
echo ""

# Test Linnworks Composition Clear
echo "🔗 Testing Linnworks Composition Clear:"
curl -X DELETE "http://localhost:3001/api/linnworks-composition" \
  -w "\nStatus: %{http_code}\n"
echo ""

echo "✅ All clear function tests completed!"
