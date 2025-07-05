// src/routes/api/linnworks-composition/summary/+server.ts
import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';

export async function POST() {
  try {
    // Fetch all compositions and SageReport data with chunked approach
    // First fetch compositions in chunks
    let allCompositions: any[] = [];
    let startIndex = 0;
    const chunkSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: chunk, error: chunkError } = await supabaseAdmin
        .from('linnworks_composition')
        .select('*')
        .range(startIndex, startIndex + chunkSize - 1);

      if (chunkError) throw chunkError;

      if (chunk && chunk.length > 0) {
        allCompositions = allCompositions.concat(chunk);
        startIndex += chunkSize;
        hasMore = chunk.length === chunkSize;
      } else {
        hasMore = false;
      }
    }

    // Fetch sage reports in chunks
    let allSageReports: any[] = [];
    let sageStartIndex = 0;
    let sageHasMore = true;

    while (sageHasMore) {
      const { data: sageChunk, error: sageChunkError } = await supabaseAdmin
        .from('sage_reports')
        .select('*')
        .range(sageStartIndex, sageStartIndex + chunkSize - 1);

      if (sageChunkError) throw sageChunkError;

      if (sageChunk && sageChunk.length > 0) {
        allSageReports = allSageReports.concat(sageChunk);
        sageStartIndex += chunkSize;
        sageHasMore = sageChunk.length === chunkSize;
      } else {
        sageHasMore = false;
      }
    }

    const compositions = allCompositions;
    const sageReports = allSageReports;
    const sageBySku = Object.fromEntries(sageReports.map(s => [s.stock_code, s]));

    console.log('Total compositions fetched:', compositions.length);
    console.log('Total sage reports fetched:', sageReports.length);

    // Check specifically for our problem SKU
    const problemSKU = compositions.find(c => c.parent_sku === '0X-U12R-J16J');
    if (problemSKU) {
      console.log('Found problem SKU in compositions:', problemSKU);
      console.log('Child SKU lookup in sage:', sageBySku[problemSKU.child_sku]);
    } else {
      console.log('Problem SKU not found in compositions');
    }

    console.log('Found compositions:', compositions.length);
    console.log('Found sage reports:', sageReports.length);
    console.log('Sample sage report:', sageReports[0]);
    if (sageReports.length > 0) {
      console.log('Sample sage SKU mapping:', Object.keys(sageBySku).slice(0, 5));
    }

    // Group by parent_sku
    const grouped: Record<string, typeof compositions> = {};
    for (const comp of compositions) {
      if (!grouped[comp.parent_sku]) grouped[comp.parent_sku] = [];
      grouped[comp.parent_sku].push(comp);
    }

    // Remove all previous summaries - use a more explicit delete
    const { error: deleteError } = await supabaseAdmin
      .from('linnworks_composition_summary')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (deleteError) {
      console.error('Error deleting previous summaries:', deleteError);
      // Continue anyway, as we might be able to insert new data
    }

    // For each parent_sku, build summary
    const summariesToInsert = [];
    for (const parentSKU of Object.keys(grouped)) {
      const group = grouped[parentSKU];
      const parentTitle = group[0]?.parent_title || '';
      const childSKUs = group.map((c: any) => c.child_sku);
      const childTitles = group.map((c: any) => c.child_title || '');
      const childQuantities = group.map((c: any) => c.quantity);
      const childPrices = group.map((c: any) => {
        // Use standard_cost from SageReport instead of price
        const sage = sageBySku[c.child_sku];
        return sage?.standard_cost ?? null;
      });
      const childVATs = group.map((c: any) => {
        const sage = sageBySku[c.child_sku];
        return sage?.tax_rate ?? null;
      });
      // Qty for parent
      const totalQty = group.reduce((sum: number, c: any) => sum + (c.quantity || 0), 0);
      // Total value: sum of (child standard_cost * quantity)
      const totalValue = group.reduce((sum: number, c: any) => {
        const cost = sageBySku[c.child_sku]?.standard_cost ?? 0;
        return sum + cost * (c.quantity || 0);
      }, 0);

      // Debug logging for problem SKU
      if (parentSKU === '0X-U12R-J16J') {
        console.log('Processing problem SKU:', parentSKU);
        console.log('Group:', group);
        console.log('Child prices:', childPrices);
        console.log('Child VATs:', childVATs);
        console.log('Total value:', totalValue);
      }

      summariesToInsert.push({
        parent_sku: parentSKU,
        parent_title: parentTitle,
        child_skus: JSON.stringify(childSKUs),
        child_titles: JSON.stringify(childTitles),
        child_quantities: JSON.stringify(childQuantities),
        child_prices: JSON.stringify(childPrices),
        child_vats: JSON.stringify(childVATs),
        total_qty: totalQty,
        total_value: totalValue,
      });
    }

    console.log('Total summaries to insert:', summariesToInsert.length);
    console.log('Unique parent SKUs from grouping:', Object.keys(grouped).length);

    if (summariesToInsert.length > 0) {
      const { error } = await supabaseAdmin
        .from('linnworks_composition_summary')
        .insert(summariesToInsert);

      if (error) throw error;
    }

    return json({ success: true, message: 'Summary generated.' });
  } catch (e) {
    console.error('Error generating summary:', e);
    return json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}

export async function GET({ url }) {
  try {
    const search = url.searchParams.get('search');

    // Fetch all summaries using chunked approach
    let allSummaries: any[] = [];
    let startIndex = 0;
    const chunkSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabaseAdmin
        .from('linnworks_composition_summary')
        .select('*')
        .order('parent_sku', { ascending: true })
        .range(startIndex, startIndex + chunkSize - 1);

      if (search) {
        query = query.ilike('parent_title', `%${search}%`);
      }

      const { data: chunk, error: chunkError } = await query;
      if (chunkError) throw chunkError;

      if (chunk && chunk.length > 0) {
        allSummaries = allSummaries.concat(chunk);
        startIndex += chunkSize;
        hasMore = chunk.length === chunkSize;
      } else {
        hasMore = false;
      }
    }

    return json({ success: true, data: allSummaries });
  } catch (e) {
    console.error('Error fetching summaries:', e);
    return json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
