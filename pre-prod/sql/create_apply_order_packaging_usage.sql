-- Drop the existing function first to handle parameter default changes
DROP FUNCTION IF EXISTS public.apply_order_packaging_usage(text, uuid, integer);
DROP FUNCTION IF EXISTS public.apply_order_packaging_usage(text, uuid, integer, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.apply_order_packaging_usage(
  p_amazon_order_id text,
  p_supply_id uuid,
  p_quantity integer,
  p_usage_date timestamp with time zone DEFAULT now()
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_new_stock integer;
BEGIN
  -- 1. Check if already applied (idempotency)
  -- The unique constraint "unique_movement_reference_supply" on packing_inventory_ledger 
  -- (movement_type, reference_id, supply_id) handles this, but we check cleanly first.
  IF EXISTS (
    SELECT 1 FROM packing_inventory_ledger
    WHERE movement_type = 'amazon_order_usage'
      AND reference_id = p_amazon_order_id
      AND supply_id = p_supply_id
  ) THEN
    RETURN 'already_applied';
  END IF;

  -- 2. Insert ledger entry (negative change for usage)
  INSERT INTO packing_inventory_ledger (
    supply_id,
    change_amount,
    reason,
    reference_id,
    movement_type,
    created_at
  ) VALUES (
    p_supply_id,
    -p_quantity, -- Negative amount to reduce stock
    'Order Usage',
    p_amazon_order_id,
    'amazon_order_usage',
    p_usage_date
  );

  -- 3. Update current stock in packing_supplies
  -- Assuming packing_supplies has a 'current_stock' column
  UPDATE packing_supplies
  SET current_stock = COALESCE(current_stock, 0) - p_quantity
  WHERE id = p_supply_id
  RETURNING current_stock INTO v_new_stock;

  IF v_new_stock < 0 THEN
    RETURN 'applied_negative_stock';
  ELSE
    RETURN 'applied';
  END IF;

EXCEPTION
  WHEN unique_violation THEN
    RETURN 'already_applied';
  WHEN OTHERS THEN
    RAISE;
END;
$function$;
