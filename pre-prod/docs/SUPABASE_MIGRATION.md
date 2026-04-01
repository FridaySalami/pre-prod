# Supabase Migration Guide

This guide walks you through migrating your Pricer application from SQLite to Supabase PostgreSQL.

## Phase 1: Database Setup & Schema Migration

### Prerequisites
- Supabase project already set up ✅
- Supabase client configured ✅

### Step 1: Run the Migration Helper
```bash
./migrate-to-supabase.sh
```
This script will:
- Backup your current SQLite database
- Export all existing data to CSV files
- Generate new Prisma client

### Step 2: Update Your Environment Variables
Copy `.env.example` to `.env` and update with your Supabase credentials:
```bash
cp .env.example .env
```

Update `.env` with your Supabase details:
```env
DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
PUBLIC_SUPABASE_URL="https://[project-ref].supabase.co"
PUBLIC_SUPABASE_ANON_KEY="[your-anon-key]"
PRIVATE_SUPABASE_SERVICE_KEY="[your-service-key]"
```

### Step 3: Create Database Schema
1. Open your Supabase SQL Editor
2. Copy and paste the contents of `supabase-migration.sql`
3. Run the script to create all tables and indexes

### Step 4: Sync Prisma Schema
```bash
npx prisma db push
```

### Step 5: Validate Migration
```bash
node validate-migration.js
```

## Current Data Export Files
After running the migration helper, you'll have these files:
- `export_amazon_listings.csv` - Amazon seller listings
- `export_inventory.csv` - Inventory items
- `export_sage_reports.csv` - Sage accounting data
- `export_linnworks_composition.csv` - Linnworks BOM data

## Database Schema Changes

### New PostgreSQL Features
- UUID primary keys with `gen_random_uuid()`
- Proper PostgreSQL timestamp types
- Snake_case column naming for PostgreSQL conventions
- Optimized indexes for large datasets
- Update triggers for `updated_at` columns

### Table Mapping
| Old Table | New Table | Changes |
|-----------|-----------|---------|
| `amazon_listings` | `amazon_listings` | Updated field names to snake_case |
| `inventory` | `inventory` | Updated field names to snake_case |
| `SageReport` | `sage_reports` | Updated field names to snake_case |
| `LinnworksComposition` | `linnworks_composition` | Updated field names to snake_case |
| New | `import_records` | Track CSV uploads |
| New | `audit_log` | Track changes |

### Performance Improvements
- Indexed commonly queried fields
- Optimized for 10,000+ record operations
- Prepared for batch processing

## Next Steps (Phase 2)
1. Update service files to use Supabase
2. Enhance CSV upload endpoints
3. Implement progress tracking
4. Add error handling and recovery

## Rollback Plan
If needed to rollback:
1. Change `DATABASE_URL` back to SQLite in `.env`
2. Run `npx prisma db push` 
3. Restore from `./prisma/dev.db.backup.*`

## Testing Checklist
- [ ] Database connection works
- [ ] All tables created successfully
- [ ] Indexes created properly
- [ ] Prisma client generates without errors
- [ ] Basic CRUD operations work
- [ ] CSV data can be imported

## Support
If you encounter issues:
1. Check Supabase project status
2. Verify environment variables
3. Check network connectivity
4. Review Supabase logs for errors
