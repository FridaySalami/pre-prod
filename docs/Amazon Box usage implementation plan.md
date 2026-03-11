# Amazon Order Costing & Box Usage Automation Plan

## Objective

Create an automated workflow that, at the point Amazon order details are fetched/imported, will:

1. apply the existing `CostCalculator`
2. persist the calculated cost breakdown to Supabase
3. persist the selected box used for the shipment
4. create stock movement records for packaging usage
5. update packaging inventory safely and idempotently
6. enable reporting for daily box usage, stock remaining, and reorder planning

This plan is intended for implementation by a VS Code AI coding agent.

---

## Current Situation

### Existing pieces already in place

* A `CostCalculator` class exists and returns:
  * `baseCost`, `boxCost`, `materialCost`, `fragileCharge`, `shippingCost`, `amazonFee`, `box`, `shipping`, `shippingType`, `vatCode`, `itemName`
* A packaging management UI already exists with:
  * `packing_suppliers`, `packing_supplies`, `packing_supplier_prices`, `packing_invoices`, `packing_invoice_lines`, `packing_inventory_ledger`
* Inventory values and current stock are already shown on the packing supplies page.

### Current gaps

* `CostCalculator` calculates the box but does **not** save box usage anywhere.
* Packaging inventory is tracked on the purchase side, but not yet on the consumption side.
* Box costs are still hard-coded in the calculator instead of being driven by the packaging database.
* There is currently no guaranteed idempotent workflow to prevent duplicate stock deductions if cost calculation runs more than once.

---

## Required End State

When Amazon order details are fetched/imported:

1. each order is enriched with costing data
2. the selected box is resolved to a `packing_supplies` record (using primary code or `alt_codes`)
3. the costing result is saved to Supabase
4. an atomic order-level packaging usage row / stock ledger row is created
5. `current_stock` is updated safely via Postgres RPC
6. repeated imports or page reloads must **not** double-deduct stock

---

## Design Principles

### 1. Keep `CostCalculator` mostly pure
Do not turn `CostCalculator` into a class that directly mutates stock. No DB writes.
It should: fetch needed cost inputs, calculate costs, return a structured result.

### 2. Treat packaging usage as an inventory movement in a Single Ledger
All packaging consumption events must use the `packing_inventory_ledger` table.
There is **no separate** `packing_stock_movements` table. 
The ledger handles: invoice arrivals (+), amazon order usage (-), manual adjustments/damages (+/-).

### 3. Make the workflow idempotent
The same order must not consume stock multiple times just because of page reloads or job retries.
There must be one authoritative usage record per order shipment event.

### 4. Separate Assignment from Application
- **Assignment ("We believe this order will use box X"):** Happens during order enrichment API.
- **Application ("We are now consuming stock for box X"):** Happens atomically via RPC **only** when the order status indicates a commitment to ship (e.g. Unshipped, Ready to dispatch, Shipped). Note: Do NOT deduct on 'Pending' or 'Canceled'.

### 5. Order-level packaging by default (V1 Assumption)
Assume one order uses one recorded box unless explicitly split. Future implementations will shift idempotency from `amazon_order_id` to `amazon_shipment_id`.

---

## Recommended Data Model Changes

### A. Add an order packaging assignment table

Suggested table: `amazon_order_packaging`
Stores the authoritative packaging decision per order.
* `id` uuid primary key
* `amazon_order_id` text unique not null (idempotency anchor for V1)
* `box_supply_id` uuid null (null allowed for unresolved box codes)
* `box_code` text not null
* `box_cost` numeric not null default 0
* `material_cost` numeric not null default 0
* `fragile_cost` numeric not null default 0
* `total_packaging_cost` numeric not null default 0
* `is_inventory_applied` boolean not null default false
* `inventory_applied_at` timestamptz null
* `calculated_at` timestamptz not null default now()
* `updated_at` timestamptz not null default now()

### B. Make use of the existing `packing_inventory_ledger`

Ensure `packing_inventory_ledger` has:
* `movement_type` text not null (e.g., 'invoice_receipt', 'manual_adjustment', 'amazon_order_usage', 'damage', 'correction', 'reversal')
* `reference_id` text not null (e.g., the `amazon_order_id`)
* *Unique safeguard constraint* on `(movement_type, reference_id, supply_id)` to prevent double deductions.

### C. Extend `packing_supplies`

Add:
* `alt_codes` text[] null (To handle aliases like 'LL' -> 'B04')
* `reorder_level` integer null
* `lead_time_days` integer null
* `preferred_supplier_id` uuid null
* `is_active` boolean default true

---

## Required New Service & RPC Layer

### 1. The Orchestration Service (`OrderEnrichmentService`)
Runs purely in JS/TypeScript:
- Receives fetched/imported Amazon order data
- Runs `CostCalculator`
- Resolves the calculated `boxCode` to `packing_supplies` (checking exact code or `alt_codes`)
- Upserts packaging assignment to `amazon_order_packaging`
  - If no supply match is found using code or `alt_codes`:
    - still upsert `amazon_order_packaging`
    - set `box_supply_id` = null
    - log a structured warning with `amazon_order_id`, `box_code`, and SKU
    - make these rows queryable later as a "missing mappings" queue
- *Decides* if the order status is eligible for inventory application.
- Calls the RPC if eligible.

### 2. The Atomic Postgres RPC (`apply_order_packaging_usage`)
Runs entirely in the database to prevent mid-air JavaScript failure mismatches.
Parameters: `p_amazon_order_id`, `p_supply_id`, `p_quantity`
For V1, `p_quantity` should default to 1 because packaging usage is recorded at the order level, not per item quantity.

Logic:
1. Verify assignment exists in `amazon_order_packaging` and `is_inventory_applied` is false.
2. Verify matching row does not already exist in `packing_inventory_ledger`.
3. Insert ledger row with negative quantity for the matched supply_id.
4. Decrement `packing_supplies.current_stock`.
5. Update `amazon_order_packaging.is_inventory_applied = true`.
6. Return structured status (e.g. 'applied', 'already_applied', 'missing_supply', 'applied_negative_stock').

*Negative Stock Policy:* The RPC must allow negative stock. If stock is already 0 or drops below 0 during decrement, still record the ledger movement and allow the negative stock, but return a warning status such as `applied_negative_stock` because physical usage may still have happened even if the system stock was wrong.

---

## Proposed Order Status Rule for V1
- **Pending**: Do NOT apply inventory. Costing can still run.
- **Unshipped**: Apply Inventory.
- **Shipped**: Apply Inventory (if not already applied).
- **Canceled**: Do NOT apply. (Future feature: reverse ledger entry if already applied).

---

## Recalculation / Reassignment Rule
- If costing re-runs and the calculated `box_code` is unchanged, simply update timestamps/cost fields as needed.
- If costing re-runs and the calculated `box_code` changes before inventory is applied, update the `amazon_order_packaging` row.
- If costing re-runs and the calculated `box_code` changes after inventory is already applied, do not silently switch stock usage in V1. Log for manual review or implement reversal logic in a later phase.

---

## Suggested Implementation Phases

### Phase 1 – Safe foundation
1. Identify where Amazon order fetching/enrichment currently runs
2. Migrate `amazon_order_packaging`
3. Migrate `packing_supplies.alt_codes`
4. Add orchestration service to resolve boxes and save assignments.
5. Do **not** deduct inventory yet.
*Deliverable:* Orders get a saved box assignment in Supabase. Missing `alt_code` mappings can be identified.

### Phase 2 – Atomic Inventory Deduction (RPC)
1. Write the `apply_order_packaging_usage` RPC.
2. Ensure `packing_inventory_ledger` has strict unique index mapping rules.
3. Fire RPC from orchestration service when order status is Unshipped/Shipped.
*Deliverable:* Inventory decreases automatically and safely when packaging is committed.

### Phase 3 – Cost source cleanup & Reporting
1. Replace hard-coded box lookup in CostCalculator with DB-driven box cost (e.g., Weighted Average Cost).
2. Wire up reporting on the dashboard (30-day usage, weeks remaining).

### Future Phase / Nice-to-Have
- **Cancellation Reversal:** If an order is later canceled after inventory has been applied, future logic should:
  - insert a reversal ledger row
  - restore `packing_supplies.current_stock`
  - mark the packaging assignment as reversed/cancelled with timestamp.
- **Automated Box Reassignment Reversals:** If order box code changes after stock applied, implement reversal instead of manual review block.

---

## Final Instruction to the AI Agent
First, inspect the current codebase and identify **exactly where Amazon order detail fetching/import is triggered and where `CostCalculator.calculateProductCosts()` or related costing logic is called**.

Then implement the solution in phases, preferring correctness, auditability, and idempotency over speed.
