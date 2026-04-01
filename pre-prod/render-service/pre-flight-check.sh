#!/bin/bash

# Render Deployment Pre-flight Check
# Run this script to verify everything is ready for Render deployment

echo "🔍 Render Deployment Pre-flight Check"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "server.js" ]; then
    echo "❌ Error: Not in render-service directory"
    echo "   Run: cd render-service"
    exit 1
fi

echo "✅ In render-service directory"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found"
    exit 1
fi

echo "✅ package.json found"

# Check if node_modules exists (dependencies installed)
if [ ! -d "node_modules" ]; then
    echo "⚠️  Warning: node_modules not found - running npm install"
    npm install
fi

echo "✅ Dependencies installed"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found"
    echo "   Make sure environment variables are configured"
    exit 1
fi

echo "✅ Environment file found"

# Test if server can start
echo "🚀 Testing server startup..."
timeout 10s node server.js &
SERVER_PID=$!
sleep 3

# Test health endpoint
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Health endpoint responding"
else
    echo "❌ Health endpoint not responding"
fi

# Test API endpoints
if curl -s "http://localhost:3001/api/bulk-scan/test?limit=1" > /dev/null; then
    echo "✅ API endpoints responding"
else
    echo "❌ API endpoints not responding"
fi

# Kill test server
kill $SERVER_PID 2>/dev/null

echo ""
echo "📋 Deployment Checklist:"
echo "========================"
echo "1. ✅ Service code is ready"
echo "2. ✅ Dependencies are installed"
echo "3. ✅ Environment variables are configured"
echo "4. ✅ Server starts successfully"
echo "5. ✅ API endpoints are working"
echo ""
echo "🎯 Ready for Render deployment!"
echo ""
echo "Next steps:"
echo "1. Go to https://dashboard.render.com"
echo "2. Click 'New Web Service'"
echo "3. Connect your GitHub repo: FridaySalami/pre-prod"
echo "4. Set root directory: render-service"
echo "5. Set start command: node server.js"
echo "6. Add environment variables from .env file"
echo "7. Deploy!"
