Below is a structured .md implementation plan you can drop directly into your repo (for Copilot / VS Code AI agent). It focuses on:
	•	projected 30-day usage
	•	monthly packaging spend
	•	top impact boxes
	•	dashboard metrics
	•	database queries
	•	UI additions

⸻


# Packaging Usage Forecast & Cost Impact Plan

## Objective

Extend the existing **Packing Supplies dashboard** to estimate:

1. Projected **30-day packaging usage** (with multi-window fallback)
2. Projected **monthly packaging spend** (using WAC pricing)
3. **weekly usage estimates**
4. **weeks of stock remaining**
5. **top cost drivers** (Impact ranking)
6. **highest usage boxes**

This enables better **supplier planning, purchasing decisions, and margin visibility**.

---

# Current System State

Existing data sources:

| Source | Purpose |
|------|------|
| packing_supplies | box catalog, cost, current stock |
| packing_inventory_ledger | records inventory movements |
| amazon_order_packaging | records box used per order |

Existing UI already shows:

- Current Stock
- 2-day usage
- weeks left
- stock value

However it does not yet calculate:

- projected **30-day usage**
- **monthly packaging spend**
- **highest cost boxes**

---

# Forecasting Strategy

## Robust Multi-Window Fallback

To avoid skewed projections due to holiday dips or collection gaps (e.g., failed GitHub Actions), we use a weighted approach or fallback:

### Formula: 30-Day Projected Usage

`avg_daily_2d = usage_last_2_days / 2`
`avg_daily_7d = usage_last_7_days / 7`

`usage_30d_estimate = max(avg_daily_2d, avg_daily_7d) * 30`

*Rationale: If the 2-day window is 0 due to a script failure but the 7-day window has data, the fallback prevents an "Infinite Weeks Left" error.*

---

# Cost Forecast (WAC Based)

**monthly_cost = usage_30d_estimate * weighted_avg_unit_cost**

*Note: Use `getEstimatedUnitCost()` from the `CostCalculator` which looks at historical invoices rather than just the base price in the catalog.*

Example:
- max daily avg = 10 units
- 30d estimate = 300 units
- WAC (from invoices) = £0.18
- Monthly cost = **£54.00**

---

# Impact Analysis (Pareto view)

Add an "Impact Rank" to the UI to highlight the top 3 boxes driving 80% of packaging costs.

---

# UI Additions & Required Metrics

Each box row should include:

| Metric | Formula |
|------|------|
| 30d Projected | `max(2d_avg, 7d_avg) * 30` |
| Monthly Spend | `30d_projected * cost_calc.wac` |
| Impact % | `monthly_spend / total_monthly_spend` |
| Weeks Left | `stock / (30d_projected / 4.2)` |
| Status | Alert if Weeks Left < 2 |

---

# Database Query

Example SQL (Supabase/Postgres):

```sql
select
  s.id,
  s.name,
  s.code,
  s.current_stock,
  s.avg_unit_cost,

  coalesce(sum(
    case
      when l.quantity_change < 0 then abs(l.quantity_change)
      else 0
    end
  ),0) as usage_2d,

  coalesce(sum(
    case
      when l.quantity_change < 0 then abs(l.quantity_change)
      else 0
    end
  ),0) * 15 as usage_30d_est,

  (coalesce(sum(
    case
      when l.quantity_change < 0 then abs(l.quantity_change)
      else 0
    end
  ),0) / 2.0) * 7 as weekly_est,

  (coalesce(sum(
    case
      when l.quantity_change < 0 then abs(l.quantity_change)
      else 0
    end
  ),0) * 15) * s.avg_unit_cost as monthly_cost

from packing_supplies s

left join packing_inventory_ledger l
  on l.supply_id = s.id
  and l.created_at >= now() - interval '2 days'

group by s.id, s.name, s.code, s.current_stock, s.avg_unit_cost


⸻

Dashboard Enhancements

Add summary metrics

Top of page:

Projected 30-Day Packaging Spend

SUM(monthly_cost)

Example:

£1,471 / month


⸻

Top Cost Drivers

Boxes ranked by:

monthly_cost DESC

Example:

Box	Monthly Cost
12x9x6	£351
9x6x6	£319
18x12x12	£213

This highlights supplier negotiation opportunities.

⸻

Highest Usage Boxes

Rank by:

usage_30d_est DESC

Example:

Box	Monthly Usage
9x6x6	2130
12x9x6	1170
6x6x6	720


⸻

UI Changes

Add new columns to table:

Column	Purpose
30d Est Usage	projected demand
Weekly Usage	reorder planning
Monthly Cost	cost impact
Usage Rank	most used boxes


⸻

Suggested Visualizations

Bar Chart – Monthly Packaging Spend

X axis: box type
Y axis: monthly cost

Shows financial impact.

⸻

Bar Chart – Box Usage

X axis: box type
Y axis: 30d estimated usage

Shows operational demand.

⸻

Future Improvements

When more historical data exists:

Replace extrapolation with real data:

usage_30d = sum(last 30 days)

Forecast becomes significantly more accurate.

⸻

Future Advanced Features

Reorder Prediction

Add fields:

lead_time_days
reorder_level

Predict reorder date:

days_left = current_stock / daily_avg
reorder_date = today + days_left - lead_time


⸻

Cost Forecasting

Calculate packaging spend trends:

monthly_packaging_spend
quarterly_spend
yearly_projection


⸻

Implementation Steps

Phase 1 – Backend metrics
	1.	Extend Supabase query to compute:
	•	usage_2d
	•	usage_30d_est
	•	weekly_est
	•	monthly_cost

Phase 2 – Dashboard
	2.	Add columns:
	•	30d estimate
	•	weekly usage
	•	monthly cost

Phase 3 – Summary metrics
	3.	Add top widgets:

Projected 30-day packaging spend
Top cost drivers
Highest usage boxes

Phase 4 – Visualization
	4.	Add charts for:

	•	cost impact
	•	usage distribution

⸻

Business Value

These metrics enable:
	•	supplier negotiation
	•	packaging purchasing optimization
	•	margin analysis on Amazon orders
	•	inventory planning
	•	automated reorder alerts

⸻

Long Term Vision

This becomes a packaging intelligence module inside the warehouse operations dashboard.

Potential SaaS feature for Amazon fulfilment companies:

Automated packaging usage forecasting
Packaging cost tracking
Supplier optimization
