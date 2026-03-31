# Plan: Hourly Top 100 Buy Box Monitor

This document outlines the plan for implementing a persistent, hourly Buy Box monitor for the top 100 selling items, updating a Supabase table, and providing a SvelteKit interface for review.

## 1. Database Schema (Supabase)

We will create a table `top_100_buy_box_status` to store the latest status. Rows will be updated by `sku`.

| Column | Type | Description |
| :--- | :--- | :--- |
| `sku` | `TEXT` | Primary Key, consistent with our internal SKU system. |
| `asin` | `TEXT` | Amazon Standard Identification Number. |
| `product_name` | `TEXT` | Name of the product (from catalog). |
| `buy_box_price` | `NUMERIC` | Current Buy Box winning price. |
| `currency` | `TEXT` | Currency code (e.g., GBP). |
| `is_winner` | `BOOLEAN` | Whether we (our Seller ID) are currently winning the Buy Box. |
| `competitor_price` | `NUMERIC` | The lowest price from a competitor if we aren't winning. |
| `shipping_price` | `NUMERIC` | Shipping cost if applicable. |
| `last_updated` | `TIMESTAMPTZ` | Timestamp of the most recent check. |
| `status` | `TEXT` | 'Active', 'Out of Stock', 'Suppressed', etc. |

## 2. Local Monitoring Script (`scripts/monitor-top-100-buybox.js`)

A Node.js script intended to run locally (e.g., via a cron job or a simple `while(true)` loop with `sleep`).

### Key Functions:
- **Fetch Top 100 Sellers**: Identify the top 100 SKUs. This might be hardcoded initially or fetched from an existing `sales_analytics` table in Supabase.
- **Amazon SP-API Integration**: 
    - Use `getPricing` or `getCompetitivePricing` for the ASINs.
    - Handle token refresh and rate limiting.
- **Supabase Update**:
    - Use `upsert` logic to update existing rows based on the `sku`.
    - This ensures we only have 100 rows representing the *current* state.

### Running Strategy:
- Use `node-cron` or a shell script that triggers the Node script every hour.
- Error logging to a local file or a dedicated `logs` table in Supabase.

## 3. Frontend Interface (`src/routes/buy-box-monitor/+page.svelte`)

A dashboard to visualize the status of these 100 items.

### Features:
- **Summary Cards**: Total winning, total losing, total suppressed.
- **Filterable Table**: 
    - Sort by price, winning status, or last updated.
    - Highlight rows where we've lost the Buy Box.
- **Live Updating**: Use Supabase Realtime (optional) or a simple refresh button.
- **Server Load**: `+page.server.ts` will fetch the current 100 rows from Supabase.

## 4. Implementation Steps

1. **Database Setup**: Execute SQL to create the `top_100_buy_box_status` table and enable RLS/Realtime if needed.
2. **Top 100 Identification**: Determine exactly which SKUs are the "top 100".
3. **Script Development**: Create `scripts/monitor-top-100-buybox.js` with SP-API and Supabase logic.
4. **Local Task Configuration**: Set up a local runner (e.g., a simple PM2 process or Task Scheduler).
5. **Frontend Development**: Build the SvelteKit route and page component.

---

### Questions/Refinements
- Should we keep a history of Buy Box changes, or is "current status only" sufficient as requested?
- How should we identify the "Top 100"? Is there a specific sales report/table we should pull from?
- Do we have the `seller_id` ready to compare against the `BuyBoxWinner` in the API response?
