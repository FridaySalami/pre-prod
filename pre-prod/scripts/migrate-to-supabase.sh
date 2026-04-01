#!/bin/bash

# Supabase Migration Helper Script
# This script helps migrate from SQLite to Supabase PostgreSQL

echo "🚀 Starting Supabase Migration..."

# Step 1: Backup current SQLite database
echo "📦 Creating backup of current SQLite database..."
if [ -f "./prisma/dev.db" ]; then
    cp ./prisma/dev.db "./prisma/dev.db.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✅ SQLite backup created"
else
    echo "⚠️  No SQLite database found to backup"
fi

# Step 2: Export current data (if SQLite exists)
if [ -f "./prisma/dev.db" ]; then
    echo "📊 Exporting current data..."
    
    # Export Amazon listings
    echo "  📦 Exporting Amazon listings..."
    sqlite3 ./prisma/dev.db -header -csv "SELECT * FROM amazon_listings;" > ./export_amazon_listings.csv
    
    # Export Inventory
    echo "  📋 Exporting Inventory..."
    sqlite3 ./prisma/dev.db -header -csv "SELECT * FROM inventory;" > ./export_inventory.csv
    
    # Export Sage reports
    echo "  📊 Exporting Sage reports..."
    sqlite3 ./prisma/dev.db -header -csv "SELECT * FROM SageReport;" > ./export_sage_reports.csv
    
    # Export Linnworks composition
    echo "  🧩 Exporting Linnworks composition..."
    sqlite3 ./prisma/dev.db -header -csv "SELECT * FROM LinnworksComposition;" > ./export_linnworks_composition.csv
    
    echo "✅ Data export completed"
else
    echo "⚠️  No SQLite database found - skipping data export"
fi

# Step 3: Generate new Prisma client
echo "🔄 Generating new Prisma client..."
npx prisma generate

echo "✅ Migration helper completed!"
echo ""
echo "📋 Next steps:"
echo "1. Run the supabase-migration.sql script in your Supabase SQL Editor"
echo "2. Update your .env file with Supabase credentials"
echo "3. Run 'npx prisma db push' to sync schema"
echo "4. Upload the exported CSV files using your web interface"
echo "5. Test the application"
echo ""
echo "🔄 Exported files:"
echo "  - export_amazon_listings.csv"
echo "  - export_inventory.csv"
echo "  - export_sage_reports.csv"
echo "  - export_linnworks_composition.csv"
