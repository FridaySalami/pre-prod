#!/bin/bash
# Quick clear script for BuyBox tables
# Usage: ./clear-buybox-quick.sh

echo "🧹 Clearing BuyBox tables..."

echo "📊 Current row counts:"
echo "SELECT 'buybox_offers' as table_name, COUNT(*) as row_count FROM buybox_offers;" 
echo "SELECT 'buybox_data' as table_name, COUNT(*) as row_count FROM buybox_data;"

echo ""
echo "🗑️  Clearing tables..."
echo "DELETE FROM buybox_offers;"
echo "DELETE FROM buybox_data;"

echo ""
echo "✅ Tables cleared! Run the above SQL commands in your Supabase SQL editor."
echo ""
echo "💡 Pro tip: You can also clear job history with:"
echo "DELETE FROM buybox_jobs;"
