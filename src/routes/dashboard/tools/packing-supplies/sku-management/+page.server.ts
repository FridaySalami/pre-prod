import { db } from '$lib/supabase/supabaseServer';
import { CostCalculator } from '$lib/server/cost-calculator';

export async function load({ url }: { url: URL }) {
  const dateStr = url.searchParams.get('date');
  const targetDate = dateStr ? new Date(dateStr) : new Date();
  if (!dateStr) targetDate.setDate(targetDate.getDate() - 1);

  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Fetch supplies with their default prices
  const { data: supplies } = await db
    .from('packing_supplies')
    .select(`
			*,
			packing_supplier_prices (
				supplier_id,
				default_price
			)
		`)
    .eq('is_active', true)
    .order('name');

  // Fetch unmapped orders
  let unmappedOrders: any[] = [];
  const { data: unmapped } = await db
    .from('amazon_order_packaging')
    .select('amazon_order_id, box_code, box_supply_id, calculated_at')
    .or('box_supply_id.is.null,box_code.eq.null')
    .neq('box_code', '0x0x0')
    .order('calculated_at', { ascending: false })
    .limit(50);

  if (unmapped && unmapped.length > 0) {
    const orderIds = unmapped.map((u: any) => u.amazon_order_id);
    const { data: items } = await db
      .from('amazon_order_items')
      .select('amazon_order_id, seller_sku, asin, title, item_price_amount, quantity_ordered, item_tax_amount')
      .in('amazon_order_id', orderIds);

    const { data: orders } = await db
      .from('amazon_orders')
      .select('amazon_order_id, is_prime, shipping_cost')
      .in('amazon_order_id', orderIds);

    const allSkus = Array.from(new Set(items?.map((i: any) => i.seller_sku) || []));
    const [inventoryRes, mappingRes, linnworksRes] = await Promise.all([
      db.from('inventory').select('*').in('sku', allSkus),
      db.from('sku_asin_mapping').select('*').in('seller_sku', allSkus),
      db.from('linnworks_composition_summary').select('*').in('parent_sku', allSkus)
    ]);

    const inventoryMap = new Map(inventoryRes.data?.map((i: any) => [i.sku, i]));
    const mappingMap = new Map(mappingRes.data?.map((m: any) => [m.seller_sku, m]));
    const linnworksMap = new Map(linnworksRes.data?.map((l: any) => [l.parent_sku, l]));

    const calculator = new CostCalculator();
    await calculator.initializeDynamicPrices();

    unmappedOrders = unmapped.map((u: any) => {
      const orderData = orders?.find((o: any) => o.amazon_order_id === u.amazon_order_id);
      const orderItems = (items?.filter((i: any) => i.amazon_order_id === u.amazon_order_id) || []).map((item: any) => {
        const itemPrice = item.item_price_amount ? parseFloat(item.item_price_amount) / item.quantity_ordered : 0;
        const itemTax = item.item_tax_amount !== null && item.item_tax_amount !== undefined
          ? parseFloat(item.item_tax_amount) / item.quantity_ordered
          : undefined;

        const product = inventoryMap.get(item.seller_sku);
        const skuMapping = mappingMap.get(item.seller_sku);
        const linnworksData = linnworksMap.get(item.seller_sku);

        let costs = null;
        if (product) {
          costs = calculator.calculate(item.seller_sku!, itemPrice, product, skuMapping, linnworksData, {
            isPrime: orderData?.is_prime,
            actualTax: itemTax,
            quantity: item.quantity_ordered
          });
        }
        return { ...item, costs };
      });
      return { ...u, items: orderItems };
    });
  }

  // Fetch Review Data (Orders for selected date)
  let reviewOrders: any[] = [];
  const { data: ordersInRange } = await db
    .from('amazon_orders')
    .select('amazon_order_id, purchase_date, is_prime')
    .gte('purchase_date', startOfDay.toISOString())
    .lte('purchase_date', endOfDay.toISOString())
    .order('purchase_date', { ascending: false });

  if (ordersInRange && ordersInRange.length > 0) {
    const orderIds = ordersInRange.map((o: any) => o.amazon_order_id);
    const { data: packingData } = await db
      .from('amazon_order_packaging')
      .select('amazon_order_id, box_code, box_supply_id, calculated_at')
      .in('amazon_order_id', orderIds);

    const { data: items } = await db
      .from('amazon_order_items')
      .select('amazon_order_id, seller_sku, asin, title, quantity_ordered, item_price_amount, item_tax_amount')
      .in('amazon_order_id', orderIds);

    const allSkus = Array.from(new Set(items?.map((i: any) => i.seller_sku) || []));
    const [inventoryRes, mappingRes, linnworksRes] = await Promise.all([
      db.from('inventory').select('*').in('sku', allSkus),
      db.from('sku_asin_mapping').select('*').in('seller_sku', allSkus),
      db.from('linnworks_composition_summary').select('*').in('parent_sku', allSkus)
    ]);

    const inventoryMap = new Map(inventoryRes.data?.map((i: any) => [i.sku, i]));
    const mappingMap = new Map(mappingRes.data?.map((m: any) => [m.seller_sku, m]));
    const linnworksMap = new Map(linnworksRes.data?.map((l: any) => [l.parent_sku, l]));

    const calculator = new CostCalculator();
    await calculator.initializeDynamicPrices();

    reviewOrders = ordersInRange.map((o: any) => {
      const packing = packingData?.find((p: any) => p.amazon_order_id === o.amazon_order_id);
      const orderItems = (items?.filter((i: any) => i.amazon_order_id === o.amazon_order_id) || []).map((item: any) => {
        const itemPrice = item.item_price_amount ? parseFloat(item.item_price_amount) / item.quantity_ordered : 0;
        const itemTax = item.item_tax_amount !== null && item.item_tax_amount !== undefined
          ? parseFloat(item.item_tax_amount) / item.quantity_ordered
          : undefined;

        const product = inventoryMap.get(item.seller_sku);
        const skuMapping = mappingMap.get(item.seller_sku);
        const linnworksData = linnworksMap.get(item.seller_sku);

        let costs = null;
        if (product) {
          costs = calculator.calculate(item.seller_sku!, itemPrice, product, skuMapping, linnworksData, {
            isPrime: o.is_prime,
            actualTax: itemTax,
            quantity: item.quantity_ordered
          });
        }
        return { ...item, costs };
      });

      return {
        ...o,
        box_code: packing?.box_code,
        box_supply_id: packing?.box_supply_id,
        items: orderItems
      };
    });
  }

  return {
    supplies: supplies || [],
    unmappedOrders: unmappedOrders || [],
    reviewOrders: reviewOrders || [],
    selectedDate: targetDate.toISOString().split('T')[0]
  };
}
