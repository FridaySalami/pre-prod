
import { db } from '$lib/supabase/supabaseServer';
import { json } from '@sveltejs/kit';
import { getStockItemsBySku, getExtendedProperties, callLinnworksApi } from '$lib/server/linnworksClient.server';

export async function GET({ url }) {
  const query = url.searchParams.get('q') || "CAL01 - 015";
  
  try {
    const rawItems = await callLinnworksApi('Stock/GetStockItems', 'POST', {
      SearchTerm: query,
      EntriesPerPage: 10,
      PageNumber: 1,
      IncludeImages: false,
      DataRequirements: ["Inventory", "GeneralInfo", "StockLevels"] 
    });

    let extended = null;
    const stockItemId = rawItems?.Data?.[0]?.StockItemId;
    if (stockItemId) {
      extended = await callLinnworksApi('Inventory/GetStockItemExtendedProperties', 'POST', {
        stockItemIds: [stockItemId]
      });
    }

    return json({
      query,
      rawItems: rawItems?.Data || [],
      extended
    });
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}
