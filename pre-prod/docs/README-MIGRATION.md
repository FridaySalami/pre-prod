# Database Migration Required

To enable the Shipping Cost Upload feature, you need to add a `shipping_cost` column to your `amazon_orders` table in Supabase.

## Instructions

1.  Go to your Supabase Dashboard.
2.  Open the **SQL Editor**.
3.  Copy and paste the following SQL command:

```sql
-- Add shipping_cost column to amazon_orders table
ALTER TABLE amazon_orders 
ADD COLUMN IF NOT EXISTS shipping_cost numeric(10, 2);

-- Add comment to explain the column
COMMENT ON COLUMN amazon_orders.shipping_cost IS 'Actual shipping cost from Amazon Shipping CSV or Settlement Reports';
```

4.  Click **Run**.

## Verification

After running the SQL, you can verify the column was added by checking the Table Editor for `amazon_orders`.

## Usage

Once the migration is complete, you can use the new tool at:
`/dashboard/tools/upload-shipping`

Upload the CSV file from Amazon Shipping (containing "Reference #" and "Label Cost(GBP)") to automatically update your orders with actual shipping costs.
