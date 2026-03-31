# Implementation Spec: Top 100 Buy Box Monitor (v2)

This specification reflects the updated architecture for a persistent, hourly Buy Box monitor with history tracking and a SvelteKit dashboard.

## 1. Database Schema (Supabase)

We will implement a multi-table structure to separate current state from historical trends and monitor job health.

### A. `monitored_top_100_skus` (The Target List)
Materialized list of our top performers to ensure consistency across the script and UI.
- `sku` (TEXT, PK)
- `asin` (TEXT, NOT NULL)
- `product_name` {TEXT}
- `rank` (INTEGER) - 1 to 100
- `units_30d` (INTEGER)
- `revenue_30d` (NUMERIC)
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### B. `top_100_buy_box_current` (Live Dashboard)
One row per SKU. Optimized for the frontend.
- `sku` (TEXT, PK)
- `asin` (TEXT, NOT NULL)
- `product_name` (TEXT)
- `buy_box_price` (NUMERIC) - Landed price (item + shipping)
- `buy_box_currency` (TEXT)
- `our_price` (NUMERIC)
- `our_shipping_price` (NUMERIC)
- `buy_box_shipping_price` (NUMERIC)
- `is_winner` (BOOLEAN)
- `buy_box_seller_id` (TEXT)
- `buy_box_seller_name` (TEXT)
- `competitor_price` (NUMERIC)
- `competitor_seller_id` (TEXT)
- `competitor_seller_name` (TEXT)
- `offer_count` (INTEGER)
- `status` (TEXT) - `WINNING`, `LOSING`, `SUPPRESSED`, `OUT_OF_STOCK`, etc.
- `checked_at` (TIMESTAMPTZ, DEFAULT NOW())
- `last_changed_at` (TIMESTAMPTZ)
- `suppressed_reason` (TEXT)
- `marketplace_id` (TEXT, DEFAULT 'A1F83G8C2ARO7P')

### C. `top_100_buy_box_history` (Trend Analysis)
Append-only snapshots.
- `id` (BIGSERIAL, PK)
- `sku`, `asin`, `buy_box_price`, `is_winner`, `status`, etc. (Mirror of current columns)
- `checked_at` (TIMESTAMPTZ, DEFAULT NOW())
- `change_detected` (BOOLEAN, DEFAULT FALSE)

### D. `buy_box_monitor_runs` (Job Health)
- `id` (BIGSERIAL, PK)
- `started_at` (TIMESTAMPTZ, DEFAULT NOW())
- `finished_at` (TIMESTAMPTZ)
- `status` (TEXT) - `SUCCESS`, `PARTIAL_FAILURE`, `FATAL_ERROR`
- `total_skus` (INTEGER)
- `success_count` (INTEGER)
- `error_count` (INTEGER)
- `notes` (TEXT)

---

## 2. Local Monitoring Script (`scripts/monitor-top-100-buybox.js`)

### Logic Flow:
1. **Refresh Target List**: (Optional) Pull top 100 from sales analytics and update `monitored_top_100_skus`.
2. **Batch SP-API Calls**: Use `getPricing` or `getCompetitivePricing`.
3. **Compare & Process**:
    - For each SKU, compare new API data with `top_100_buy_box_current`.
    - If `status`, `is_winner`, or `buy_box_price` changed, update `last_changed_at` and set `change_detected = true` for history.
4. **Transaction-ish Update**: 
    - `upsert` to `top_100_buy_box_current`.
    - `insert` to `top_100_buy_box_history`.
5. **Log Run**: Create entry in `buy_box_monitor_runs`.

---

## 3. Frontend Dashboard (`src/routes/buy-box-monitor/`)

### `+page.server.ts`
- Fetch all rows from `top_100_buy_box_current`.
- Fetch the latest successful run from `buy_box_monitor_runs` to determine data "freshness".
- Calculate high-level stats: % Winning, % Losing, total revenue at risk.

### `+page.svelte`
- **Freshness Banner**: Warning if `checked_at` > 75 mins.
- **Metric Cards**: Large numbers for Win/Loss/Suppressed.
- **Actionable Table**: 
    - Highlight rows with `LOSING` status.
    - Show "Price Gap" clearly.
    - Sorting by "Last Changed" to see what recently flipped.

---

## 4. Implementation Plan

### Step 1: SQL Injection
Execute the schema creation script in Supabase.

### Step 2: Script Development
Create the Node.js script using existing SP-API helpers.

### Step 3: Frontend Route
Build the SvelteKit page with Shadcn/Svelte components.

### Step 4: Scheduling
Configure local task (Windows Task Scheduler) to run `node scripts/monitor-top-100-buybox.js` every hour.
