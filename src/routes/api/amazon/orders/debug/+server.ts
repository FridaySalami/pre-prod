import { json } from '@sveltejs/kit';
import { db } from '$lib/supabaseServer';
import { CostCalculator } from '$lib/server/cost-calculator';

export async function GET({ url }) {
  const orderId = url.searchParams.get('orderId');
  const sku = url.searchParams.get('sku');

  if (!orderId || !sku) {
    return json({ error: 'Missing orderId or sku' }, { status: 400 });
  }

  const logs: string[] = [];
  const log = (msg: any) => {
    if (typeof msg === 'object') logs.push(JSON.stringify(msg, null, 2));
    else logs.push(String(msg));
  };

  try {
    log(`Debugging Order: ${orderId}`);
    log(`Target SKU: ${sku}`);

    const { data: order, error } = await db
      .from('amazon_orders')
      .select('*, amazon_order_items(*)')
      .eq('amazon_order_id', orderId)
      .single();

    if (error || !order) {
      log('Error fetching order or order not found');
      if (error) log(error);
      return json({ logs });
    }

    log(`Is Prime: ${order.is_prime}`);

    const item = order.amazon_order_items.find((i: any) => i.seller_sku === sku);
    if (!item) {
      log('Item not found in order');
      return json({ logs });
    }

    const itemPrice = item.item_price_amount ? parseFloat(item.item_price_amount) / item.quantity_ordered : 0;
    const itemTax = item.item_tax_amount !== null ? parseFloat(item.item_tax_amount) / item.quantity_ordered : undefined;
    log(`Item Price: ${itemPrice}`);
    log(`Item Tax (per unit): ${itemTax}`);

    // 1. Fetch Inventory
    const { data: product, error: invError } = await db
      .from('inventory')
      .select('*')
      .eq('sku', sku)
      .single();
    log('Inventory Data:');
    if (invError) log(invError);
    else log(product);

    // 2. Fetch Mapping
    const { data: mapping, error: mapError } = await db
      .from('sku_asin_mapping')
      .select('*')
      .eq('seller_sku', sku)
      .single();
    log('Mapping Data:');
    if (mapError) log(mapError);
    else log(mapping);

    // 3. Fetch Linnworks
    const { data: linnworks, error: linnError } = await db
      .from('linnworks_composition_summary')
      .select('*')
      .eq('parent_sku', sku)
      .single();
    log('Linnworks Data:');
    if (linnError) log(linnError);
    else log(linnworks);

    // 4. Run Calculator
    const calculator = new CostCalculator();
    const costs = await calculator.calculateProductCosts(sku, itemPrice, {
      isPrime: order.is_prime,
      actualTax: itemTax,
      quantity: item.quantity_ordered
    });
    log('Calculated Costs:');
    log(costs);

    return json({ logs });

  } catch (e) {
    log(`Error: ${e}`);
    return json({ logs });
  }
}
