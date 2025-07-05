import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';

export async function GET() {
  try {
    // Fetch reference data from Product table
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('sku, stock_level, dimensions, cost, list_price, name, weight, active');

    if (error) throw error;

    // Parse dimensions into depth, height, width if possible
    const data = products.map(p => {
      let depth = '', height = '', width = '';
      if (p.dimensions) {
        // Assume format: "LxWxH" or "Depth x Height x Width" (customize as needed)
        const parts = p.dimensions.split(/[xX*]/).map((s: string) => s.trim());
        if (parts.length === 3) {
          [depth, height, width] = parts;
        }
      }
      return {
        sku: p.sku,
        stockLevel: p.stock_level ?? '-',
        depth,
        height,
        width,
        purchasePrice: p.cost ?? '-',
        retailPrice: p.list_price ?? '-',
        title: p.name,
        tracked: p.active ? 'Yes' : 'No',
        weight: p.weight ?? '-'
      };
    });
    return json({ success: true, data, raw: products });
  } catch (e) {
    console.error('Error fetching reference data:', e);
    return json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
