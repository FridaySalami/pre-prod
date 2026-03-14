import { db } from '$lib/supabase/supabaseServer';
import { json } from '@sveltejs/kit';
import { getStockItemsBySku, getExtendedProperties } from '$lib/server/linnworksClient.server';

export async function GET({ url }) {
  const query = url.searchParams.get('q');
  if (!query || query.length < 2) {
    return json({ results: [] });
  }

  try {
    // 1. Search in the local inventory table
    const { data: inventoryData, error } = await db
      .from('inventory')
      .select('sku, title, width, height, depth')
      .or(`sku.ilike.%${query}%,title.ilike.%${query}%`)
      .limit(20);

    if (error) throw error;

    if (!inventoryData || inventoryData.length === 0) {
      return json({ results: [] });
    }

    const skus = inventoryData.map(d => d.sku);

    // 2. Fetch data from Linnworks in parallel
    const trimmedSkus = inventoryData.map((d: any) => d.sku.trim());
    console.log('Searching Linnworks for SKUs:', trimmedSkus);

    const [mappings, lwItems, supplies] = await Promise.all([
      db.from('sku_asin_mapping').select('seller_sku, asin, item_note').in('seller_sku', skus),
      getStockItemsBySku(trimmedSkus),
      db.from('packing_supplies').select('id, code, name, current_stock')
    ]);

    const mappingMap = new Map(mappings.data?.map(m => [m.seller_sku, m]));
    const supplyMap = new Map(supplies.data?.map(s => [s.code, s]));
    const lwItemMap = new Map();
    const stockItemIds: string[] = [];

    const normalizeSku = (s: string | undefined | null) => (s || '').trim().toLowerCase();

    if (Array.isArray(lwItems)) {
      lwItems.forEach(item => {
        const skuKey = normalizeSku(item.ItemNumber || item.SKU);
        if (skuKey) {
          lwItemMap.set(skuKey, item);
        }
        if (item.StockItemId) stockItemIds.push(item.StockItemId);
      });
    }

    // 3. Fetch Extended Properties if we have StockItemIds
    let extendedProps: any[] = [];
    if (stockItemIds.length > 0) {
      extendedProps = await getExtendedProperties(stockItemIds);
    }

    // Group extended properties by StockItemId
    const propMap = new Map();
    extendedProps.forEach(p => {
      if (!propMap.has(p.StockItemId)) propMap.set(p.StockItemId, []);
      propMap.get(p.StockItemId).push(p);
    });

    return json({
      results: inventoryData.map((item: any) => {
        const m = mappingMap.get(item.sku);
        const normLocalSku = normalizeSku(item.sku);
        const lwItem = lwItemMap.get(normLocalSku);

        const props = propMap.get(lwItem?.StockItemId) || [];

        // Comparison logic
        const lwDims = {
          w: lwItem?.Width || lwItem?.DimWidth || 0,
          h: lwItem?.Height || lwItem?.DimHeight || 0,
          d: lwItem?.Depth || lwItem?.DimDepth || 0
        };

        // DEBUG LOGGING IN SERVER TO SEE FINAL MAPPING
        if (lwItem) {
          console.log(`[SEARCH MAPPING] Matched ${item.sku} to Linnworks ${lwItem.ItemNumber}. Dims: ${lwDims.w}x${lwDims.h}x${lwDims.d}. Group: ${lwItem.PackageGroupName}`);
        } else {
          console.log(`[SEARCH MAPPING] NO MATCH for ${item.sku}`);
        }

        // Logical box: Manual box code OR calculated from dimensions
        const calculatedBox = `${item.width ?? ''}x${item.height ?? ''}x${item.depth ?? ''}`.replace(/^xx$/, '0x0x0');
        const effectiveBox = m?.item_note || (calculatedBox !== 'xx' && calculatedBox !== 'nullxnullxnull' ? calculatedBox : '');

        // Find Extended Property for Box Size with robust fuzzy matching
        const boxSizeKeywords = [
          'box size', 'boxsize', 'box', 'packaging', 'package size',
          'package', 'shipping group', 'packagegroup', 'box_code',
          'boxcode', 'box dimensions', 'carton', 'carton size',
          'pack type', 'large letter'
        ];

        const exactPropNames = ['Box', 'Box Size', 'Pack Type', 'Large Letter'];

        const boxSizeProp = props.find((p: any) => {
          const name = (p.ProperyName || p.PropertyName || '').trim();
          const lowerName = name.toLowerCase();
          
          if (exactPropNames.some(exact => exact.toLowerCase() === lowerName)) return true;
          return boxSizeKeywords.some(keyword => lowerName.includes(keyword));
        });

        const hasMismatch = Math.abs((item.width || 0) - lwDims.w) > 0.1 ||
          Math.abs((item.height || 0) - lwDims.h) > 0.1 ||
          Math.abs((item.depth || 0) - lwDims.d) > 0.1;

        // Final Box Calculation preference:
        // 1. Extended Property (e.g. "9x6x6" in "Box Size" or similar)
        // 2. Packaging Group Name (if not "Default" and not "0x0x0")
        // 3. Local inventory/mapping code
        const lwPackageGroup = lwItem?.PackageGroupName || lwItem?.DefaultPackageGroup;
        
        // Priority: Ext Prop Value -> Package Group -> Manual Mapping/Effective Box
        const finalBoxDisplay = (boxSizeProp?.PropertyValue || '').trim() || 
                                (lwPackageGroup && lwPackageGroup !== 'Default' && lwPackageGroup !== '0x0x0' ? lwPackageGroup : effectiveBox);

        const matchedSupply = supplyMap.get(finalBoxDisplay);

        return {
          sku: item.sku,
          name: item.title,
          asin: m?.asin || 'No ASIN',
          box_code: finalBoxDisplay,
          inventory_dims: `${item.width || 0}x${item.height || 0}x${item.depth || 0}`,
          supply_match: matchedSupply ? {
            id: matchedSupply.id,
            name: matchedSupply.name,
            stock: matchedSupply.current_stock
          } : null,
          linnworks: {
            dims: lwDims,
            mismatch: hasMismatch,
            box_size_prop: boxSizeProp?.PropertyValue,
            props: props.map((p: any) => ({
              name: p.ProperyName || p.PropertyName,
              value: p.PropertyValue,
              type: p.PropertyType
            }))
          }
        };
      })
    });
  } catch (e) {
    console.error('Error searching SKUs:', e);
    return json({ error: 'Failed to search SKUs' }, { status: 500 });
  }
}
