
import { db } from '$lib/supabase/supabaseServer';
import { CostCalculator } from '$lib/server/cost-calculator';

interface AmazonOrderItem {
  seller_sku?: string;
  asin?: string;
  item_price_amount?: string;
  item_tax_amount?: string | null;
  quantity_ordered: number;
  [key: string]: any;
}

export async function fetchOrdersData(startDate: Date, endDate: Date, searchTerm?: string, processPackagingOperations: boolean = false) {
  let orders: any[] = [];
  let error = null;

  if (searchTerm) {
    const term = searchTerm.trim();

    // 1. Search orders by ID
    const { data: ordersById, error: error1 } = await db
      .from('amazon_orders')
      .select('amazon_order_id')
      .ilike('amazon_order_id', `%${term}%`);

    // 2. Search items by SKU or ASIN
    const { data: itemsBySkuOrAsin, error: error2 } = await db
      .from('amazon_order_items')
      .select('amazon_order_id')
      .or(`seller_sku.ilike.%${term}%,asin.ilike.%${term}%`);

    if (error1) console.error('Error searching orders:', error1);
    if (error2) console.error('Error searching items:', error2);

    const orderIds = new Set([
      ...(ordersById?.map(o => o.amazon_order_id) || []),
      ...(itemsBySkuOrAsin?.map(i => i.amazon_order_id) || [])
    ]);

    if (orderIds.size > 0) {
      const { data: searchResults, error: searchError } = await db
        .from('amazon_orders')
        .select('*, amazon_order_items(*)')
        .in('amazon_order_id', Array.from(orderIds))
        .order('purchase_date', { ascending: false });

      orders = searchResults || [];
      error = searchError;
    }
  } else {
    // Fetch all orders with pagination to bypass 1000 row limit
    let allOrders: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: dateOrders, error: dateError } = await db
        .from('amazon_orders')
        .select('*, amazon_order_items(*)')
        .gte('purchase_date', startDate.toISOString())
        .lte('purchase_date', endDate.toISOString())
        .order('purchase_date', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (dateError) {
        error = dateError;
        break;
      }

      if (dateOrders && dateOrders.length > 0) {
        allOrders = [...allOrders, ...dateOrders];
        if (dateOrders.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    orders = allOrders;
  }

  if (error) {
    console.error('Error fetching amazon orders:', error);
    return [];
  }

  // Fetch all necessary data for cost calculations in bulk
  const allSkus = new Set<string>();
  orders.forEach(order => {
    order.amazon_order_items?.forEach((item: any) => {
      if (item.seller_sku) allSkus.add(item.seller_sku);
    });
  });

  const inventoryMap = new Map();
  const mappingMap = new Map();
  const linnworksMap = new Map();
  const bundleMap = new Map<string, number>();

  if (allSkus.size > 0) {
    const skuList = Array.from(allSkus);

    // Parallel fetch for all required data
    const [inventoryRes, mappingRes, linnworksRes] = await Promise.all([
      db.from('inventory')
        .select('id, sku, depth, height, width, weight, is_fragile')
        .in('sku', skuList),
      db.from('sku_asin_mapping')
        .select('seller_sku, merchant_shipping_group, item_name')
        .in('seller_sku', skuList),
      db.from('linnworks_composition_summary')
        .select('parent_sku, total_qty, total_value, child_vats')
        .in('parent_sku', skuList)
    ]);

    if (inventoryRes.data) {
      inventoryRes.data.forEach(i => inventoryMap.set(i.sku, i));
    }
    if (mappingRes.data) {
      mappingRes.data.forEach(m => mappingMap.set(m.seller_sku, m));
    }
    if (linnworksRes.data) {
      linnworksRes.data.forEach(l => {
        linnworksMap.set(l.parent_sku, l);
        if (l.total_qty) bundleMap.set(l.parent_sku, l.total_qty);
      });
    }
  }

  const calculator = new CostCalculator();
  await calculator.initializeDynamicPrices();

  // Enrich orders with cost data
  const enrichedOrders = orders.map((order) => {
    if (!order.amazon_order_items) return order;

    // Calculate total quantity for distributing actual shipping costs
    const totalOrderQuantity = order.amazon_order_items.reduce((sum: number, item: any) => sum + (item.quantity_ordered || 0), 0) || 1;

    // Calculate total fragile units in the order to distribute the single 1.00 charge
    let totalFragileUnits = 0;
    order.amazon_order_items.forEach((item: any) => {
      if (item.seller_sku) {
        const product = inventoryMap.get(item.seller_sku);
        if (product?.is_fragile) {
          totalFragileUnits += (item.quantity_ordered || 0);
        }
      }
    });

    const enrichedItems = order.amazon_order_items.map((item: AmazonOrderItem) => {
      if (!item.seller_sku) return item;

      // Calculate price per item for fee calculation
      const itemPrice = item.item_price_amount ? parseFloat(item.item_price_amount) / item.quantity_ordered : 0;
      const itemTax = item.item_tax_amount !== null && item.item_tax_amount !== undefined
        ? parseFloat(item.item_tax_amount) / item.quantity_ordered
        : undefined;

      // Get pre-fetched data
      const product = inventoryMap.get(item.seller_sku);
      const skuMapping = mappingMap.get(item.seller_sku);
      const linnworksData = linnworksMap.get(item.seller_sku);

      let costs = null;
      if (product) {
        // Calculate per-unit fragile charge share
        // If this item is fragile, it gets a share of the 1.00 charge.
        // Share = 1.00 / totalFragileUnits
        let customFragileCharge: number | undefined = undefined;
        if (product.is_fragile && totalFragileUnits > 0) {
          customFragileCharge = 1.00 / totalFragileUnits;
        }

        costs = calculator.calculate(item.seller_sku!, itemPrice, product, skuMapping, linnworksData, {
          isPrime: order.is_prime,
          actualTax: itemTax,
          quantity: item.quantity_ordered,
          customFragileCharge
        });

        // Override with actual shipping cost if available
        if (costs && order.shipping_cost !== null && order.shipping_cost !== undefined) {
          // Distribute actual shipping cost evenly per unit
          costs.shippingCost = Number(order.shipping_cost) / totalOrderQuantity;
          costs.shippingType = 'Actual';
        }
      }

      const bundleQuantity = bundleMap.get(item.seller_sku) || 1;

      return {
        ...item,
        costs,
        bundle_quantity: bundleQuantity
      };
    });

    return {
      ...order,
      amazon_order_items: enrichedItems
    };
  });

  // --- Phase 1: Order Enrichment & Packaging Assignment ---
  if (processPackagingOperations) {
    try {
      const { data: packingSupplies, error: suppliesError } = await db
        .from('packing_supplies')
        .select('id, code, alt_codes');

      if (suppliesError) {
        console.error('Error fetching packing supplies:', suppliesError);
      }

      // Fetch existing assignments to implement the Recalculation / Reassignment Rule
      const orderIdsList = enrichedOrders.map(o => o.amazon_order_id);
      let existingMap = new Map();

      if (orderIdsList.length > 0) {
        const { data: existingAssignments } = await db
          .from('amazon_order_packaging')
          .select('amazon_order_id, box_code, is_inventory_applied')
          .in('amazon_order_id', orderIdsList);

        if (existingAssignments) {
          existingMap = new Map(existingAssignments.map(a => [a.amazon_order_id, a]));
        }
      }

      const packagingAssignments: any[] = [];

      for (const order of enrichedOrders) {
        // 1. Determine order-level box
        let boxCode = '0x0x0';
        let boxCost = 0;
        let materialCost = 0;
        let fragileCost = 0;
        let skuForWarning = 'unknown';

        // For V1: Pick first valid box for the order
        for (const item of order.amazon_order_items || []) {
          if (item.costs) {
            if (boxCode === '0x0x0' && item.costs.box && item.costs.box !== '0x0x0') {
              boxCode = item.costs.box;
              skuForWarning = item.seller_sku || 'unknown';
            }
            // Aggregate costs
            boxCost += item.costs.boxCost || 0;
            materialCost += item.costs.materialCost || 0;
            fragileCost += item.costs.fragileCharge || 0;
          }
        }

        const totalPackagingCost = boxCost + materialCost + fragileCost;

        // 2. Resolve supply ID
        let supplyId = null;
        if (packingSupplies) {
          for (const supply of packingSupplies) {
            if (supply.code === boxCode || (supply.alt_codes && supply.alt_codes.includes(boxCode))) {
              supplyId = supply.id;
              break;
            }
          }
        }

        // 3. Recalculation / Reassignment Rule Check
        const existing = existingMap.get(order.amazon_order_id);

        if (existing) {
          if (existing.box_code === boxCode) {
            // box_code unchanged, simply update costs/timestamps
            packagingAssignments.push({
              amazon_order_id: order.amazon_order_id,
              box_supply_id: supplyId,
              box_code: boxCode,
              box_cost: boxCost,
              material_cost: materialCost,
              fragile_cost: fragileCost,
              total_packaging_cost: totalPackagingCost,
              updated_at: new Date().toISOString()
            });
          } else {
            // box_code changed
            if (existing.is_inventory_applied) {
              // Rule: do not silently switch stock usage in V1.
              console.warn(`[OrderEnrichment] Reassignment Blocked: Inventory already applied for order ${order.amazon_order_id}. Was ${existing.box_code}, now ${boxCode}. Requires manual review.`);
            } else {
              // Rule: changes before inventory is applied, update the row
              packagingAssignments.push({
                amazon_order_id: order.amazon_order_id,
                box_supply_id: supplyId,
                box_code: boxCode,
                box_cost: boxCost,
                material_cost: materialCost,
                fragile_cost: fragileCost,
                total_packaging_cost: totalPackagingCost,
                updated_at: new Date().toISOString()
              });
            }
          }
        } else {
          // New assignment
          if (!supplyId && boxCode !== '0x0x0') {
            console.warn(`[OrderEnrichment] Missing Mapping: amazon_order_id=${order.amazon_order_id}, box_code=${boxCode}, sku=${skuForWarning}`);
          }

          packagingAssignments.push({
            amazon_order_id: order.amazon_order_id,
            box_supply_id: supplyId,
            box_code: boxCode,
            box_cost: boxCost,
            material_cost: materialCost,
            fragile_cost: fragileCost,
            total_packaging_cost: totalPackagingCost
          });
        }
      }

      if (packagingAssignments.length > 0) {
        // Upsert assignments safely
        const { error: upsertError } = await db
          .from('amazon_order_packaging')
          .upsert(packagingAssignments, {
            onConflict: 'amazon_order_id'
          });
        if (upsertError) {
          console.error('Error upserting packaging assignments:', upsertError);
        } else {
          // --- Phase 2: Atomic Inventory Deduction ---
          // Now that the assignments are saved, we check order statuses and fire the RPC.
          // We only deduct if the order represents a committed shipment: 'Unshipped' or 'Shipped'.
          for (const assignment of packagingAssignments) {
            if (!assignment.box_supply_id) continue; // Skip unmapped boxes

            const order = enrichedOrders.find(o => o.amazon_order_id === assignment.amazon_order_id);
            const status = order?.order_status?.toLowerCase();

            if (status === 'unshipped' || status === 'shipped') {
              const { data: rpcResult, error: rpcError } = await db.rpc('apply_order_packaging_usage', {
                p_amazon_order_id: assignment.amazon_order_id,
                p_supply_id: assignment.box_supply_id,
                p_quantity: 1
              });

              if (rpcError) {
                console.error(`[OrderEnrichment] RPC Error for ${assignment.amazon_order_id}:`, rpcError);
              } else if (rpcResult === 'applied' || rpcResult === 'applied_negative_stock') {
                console.log(`[OrderEnrichment] Successfully deducted stock for ${assignment.amazon_order_id}. Result: ${rpcResult}`);
              } else if (rpcResult === 'already_applied') {
                // Expected idempotency behavior for repeated fetches, silently ignore
              } else {
                console.warn(`[OrderEnrichment] Unexpected RPC status for ${assignment.amazon_order_id}: ${rpcResult}`);
              }
            }
          }
          // ------------------------------------------
        }
      }
    } catch (error) {
      console.error('Failed processing packaging logic:', error);
    }
  } // End of processPackagingOperations block
  // --------------------------------------------------------

  return enrichedOrders ?? [];
}
