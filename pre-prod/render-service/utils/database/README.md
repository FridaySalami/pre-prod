/**
 * Database Utilities - README
 * 
 * This folder contains utilities for managing and inspecting the BuyBox database
 */

## Available Scripts:

### check-buybox-data.js
Check what data is currently in buybox_data and buybox_offers tables
```bash
node utils/database/check-buybox-data.js
```

### clear-buybox-tables.sql
SQL script to completely clear all buybox data
- Run in Supabase SQL editor
- Clears buybox_offers first, then buybox_data
- Optionally clears buybox_jobs

### clear-buybox-quick.sh
Quick reference for clearing commands
```bash
./utils/database/clear-buybox-quick.sh
```

## Database Schema:

### buybox_data
Main table storing Buy Box summary data per ASIN/SKU
- `asin`, `sku` - Product identifiers
- `run_id` - Links to buybox_jobs
- `price`, `is_winner` - Buy Box status
- `captured_at` - Timestamp

### buybox_offers  
Child table storing competitor offer details
- `run_id` - Links to buybox_jobs (and buybox_data)
- `asin`, `sku` - Product identifiers  
- `seller_id`, `price`, `shipping` - Competitor details
- `is_prime`, `is_fba` - Fulfillment flags

### buybox_jobs
Job tracking table
- `id`, `status`, `started_at` - Job metadata
- `successful_asins`, `failed_asins` - Progress tracking
