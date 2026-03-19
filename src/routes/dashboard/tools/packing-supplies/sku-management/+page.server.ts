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
    .order('purchase_date', { ascending: false })
    .limit(5000); // 5000 orders per day should be enough

  if (ordersInRange && ordersInRange.length > 0) {
    const orderIds = ordersInRange.map((o: any) => o.amazon_order_id);
    const { data: packingData } = await db
      .from('amazon_order_packaging')
      .select('*')
      .in('amazon_order_id', orderIds);

    const packingMap = new Map((packingData || []).map((p: any) => [p.amazon_order_id, p]));
    reviewOrders = ordersInRange.map((o: any) => ({
      ...o,
      packing: packingMap.get(o.amazon_order_id)
    }));
  }

  // --- New Tab: 7 Day Usage (Aggregated) ---
  // Default to showing [Yesterday ... 7 Days Ago] to avoid partial "Today" data
  const endWindow = new Date();
  endWindow.setDate(endWindow.getDate() - 1); // Yesterday
  endWindow.setHours(23, 59, 59, 999);

  const startWindow = new Date(endWindow);
  startWindow.setDate(startWindow.getDate() - 6); // 7 day window inclusive
  startWindow.setHours(0, 0, 0, 0);

  // Pagination required to break 1000 row limit
  let allUsageRaw: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: usagePage, error } = await db
      .from('packing_inventory_ledger')
      .select(`
        created_at,
        change_amount,
        supply_id,
        packing_supplies (name, code)
      `)
      .lt('change_amount', 0)
      .gte('created_at', startWindow.toISOString())
      .lte('created_at', endWindow.toISOString())
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching usage page:', error);
      hasMore = false;
    } else if (usagePage && usagePage.length > 0) {
      allUsageRaw.push(...usagePage);
      if (usagePage.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
    
    if (page > 50) hasMore = false; 
  }

  // Fetch 'Ships in Own Box' (0x0x0) usage separately as it doesn't hit the ledger
  // Without FK constraint, we cannot use !inner join directly. We fetch IDs and then check orders.
  // 1. Get all 0x0x0 packaging entries (small dataset ~350, so fetching all is safe)
  let ownBoxUsage: any[] = [];
  const { data: ownBoxItems } = await db
    .from('amazon_order_packaging')
    .select('amazon_order_id')
    .eq('box_code', '0x0x0')
    .limit(5000); 

  if (ownBoxItems && ownBoxItems.length > 0) {
     const ids = ownBoxItems.map((i: any) => i.amazon_order_id);
     
     // 2. Fetch orders within date range that match these IDs
     const { data: ordersWithDate } = await db
        .from('amazon_orders')
        .select('amazon_order_id, purchase_date')
        .in('amazon_order_id', ids)
        .gte('purchase_date', startWindow.toISOString())
        .lte('purchase_date', endWindow.toISOString());

     if (ordersWithDate) {
        ownBoxUsage = ordersWithDate;
     }
  }

  const usageMap = new Map<string, { id: string, name: string, code: string, total: number }>();
  const daysMap = new Map<string, number>();

  // Initialize last 7 days with 0 (Newest to Oldest)
  const dateIterator = new Date(endWindow);
  for (let i = 0; i < 7; i++) {
    const key = dateIterator.toISOString().split('T')[0];
    daysMap.set(key, 0);
    dateIterator.setDate(dateIterator.getDate() - 1);
  }

  // Process Ledger Data
  if (allUsageRaw.length > 0) {
    allUsageRaw.forEach((item: any) => {
      const qty = Math.abs(item.change_amount);
      
      // 1. Group by Supply (Total)
      const supply = item.packing_supplies;
      const id = item.supply_id || 'unknown';
      if (!usageMap.has(id)) {
        usageMap.set(id, {
          id: id,
          name: supply?.name || 'Unknown Supply',
          code: supply?.code || '',
          total: 0
        });
      }
      const entry = usageMap.get(id)!;
      entry.total += qty;

      // 2. Group by Day
      if (item.created_at) {
        const dayKey = item.created_at.split('T')[0]; // YYYY-MM-DD
        if (daysMap.has(dayKey)) {
           daysMap.set(dayKey, (daysMap.get(dayKey) || 0) + qty);
        }
      }
    });
  }

  // Process Own Box Data
  if (ownBoxUsage && ownBoxUsage.length > 0) {
    const ownBoxId = '0x0x0-virtual-id';
    usageMap.set(ownBoxId, {
      id: ownBoxId,
      name: 'Ships in Own Box',
      code: '0x0x0',
      total: ownBoxUsage.length // Add to total list
    });

    ownBoxUsage.forEach((item: any) => {
      // Logic adjusted for direct order objects from separate fetch
      const pDate = item.purchase_date;
      
      if (pDate) {
        const dayKey = pDate.split('T')[0];
        if (daysMap.has(dayKey)) {
          // We include 0x0x0 usage in the Daily Total graph if desired
           daysMap.set(dayKey, (daysMap.get(dayKey) || 0) + 1);
        }
      }
    });
  }

  const usageData = Array.from(usageMap.values()).sort((a, b) => b.total - a.total);
  
  // Convert map to array (already sorted by insertion order if desired, but we explicitly sort for safety)
  const usageByDay = Array.from(daysMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0])) // Descending (newest first)
    .map(([dateIso, total]) => ({
      date: new Date(dateIso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
      total
    }));

  return {
    supplies: supplies || [],
    unmappedOrders,
    reviewOrders,
    selectedDate: targetDate.toISOString().split('T')[0],
    usageData,
    usageByDay
  };
}

