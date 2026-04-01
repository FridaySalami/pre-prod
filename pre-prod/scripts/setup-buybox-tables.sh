#!/bin/bash

# Script to set up the Buy Box monitoring tables in Supabase

echo "=========================================="
echo "Buy Box Tables Setup/Update Script"
echo "=========================================="
echo ""

# Check if required environment variables are set
if [ -z "$SUPABASE_DB_HOST" ] || [ -z "$SUPABASE_DB_PASSWORD" ]; then
    # Load environment variables from .env file if it exists
    if [ -f .env ]; then
        echo "Loading environment variables from .env file..."
        # shellcheck disable=SC1091
        source .env
    fi
fi

# Option 1: If you have direct psql access to your Supabase instance
# Replace these variables with your actual connection details
DB_HOST="${SUPABASE_DB_HOST:-localhost}"
DB_PORT="${SUPABASE_DB_PORT:-5432}"
DB_NAME="${SUPABASE_DB_NAME:-postgres}"
DB_USER="${SUPABASE_DB_USER:-postgres}"
DB_PASSWORD="${SUPABASE_DB_PASSWORD:-postgres}"

echo "Using database: $DB_NAME on $DB_HOST"
echo ""

# Check if we have the required scripts
if [ ! -f "setup-buybox-tables.sql" ]; then
    echo "Error: setup-buybox-tables.sql file not found."
    exit 1
fi

# Create tables using psql
echo "Creating/updating Buy Box tables..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -U "$DB_USER" -f setup-buybox-tables.sql

# If tables already exist, run the update script
if [ -f "update-buybox-schema.sql" ]; then
    echo ""
    echo "Applying schema updates..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -U "$DB_USER" -f update-buybox-schema.sql
fi

echo ""
echo "=========================================="
echo "Buy Box tables setup/update complete!"
echo "=========================================="
echo ""
echo "If you're experiencing issues with data not being saved, try running:"
echo "node restart-buybox-job.mjs"
echo "This will reset the Buy Box monitoring system and trigger a fresh run."

# Option 2: If using supabase CLI with local development
# supabase db execute < setup-buybox-tables.sql

echo "Buy Box monitoring tables have been set up successfully!"
