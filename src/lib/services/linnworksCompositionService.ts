// src/lib/services/linnworksCompositionService.ts
import { supabaseAdmin } from '$lib/supabaseAdmin';

export const linnworksCompositionService = {
  /**
   * Generates summary data for Linnworks compositions by calculating costs based on Sage reports.
   * This logic is shared between the manual "Generate Summary" button and automated triggers.
   */
  async generateSummary() {
    try {
      // Chunk size for fetching data
      const chunkSize = 1000;

      // 1. Fetch all compositions
      let allCompositions: any[] = [];
      let startIndex = 0;
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

      // 2. Fetch sage reports
      let allSageReports: any[] = [];
      let sageStartIndex = 0;
      let sageHasMore = true;

      while (sageHasMore) {
        const { data: sageChunk, error: sageChunkError } = await supabaseAdmin
          .from('sage_reports')
          .select('*')
          .range(sageStartIndex, sageStartIndex + chunkSize - 1)
          // Optimized: maybe we should select fewer columns if these objects are huge, 
          // but for now '*' is fine to keep existing behavior
          ;

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

      // Group by parent_sku
      const grouped: Record<string, typeof compositions> = {};
      for (const comp of compositions) {
        if (!grouped[comp.parent_sku]) grouped[comp.parent_sku] = [];
        grouped[comp.parent_sku].push(comp);
      }

      // 3. Delete existing summary data
      const { error: deleteError } = await supabaseAdmin
        .from('linnworks_composition_summary')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records logic (assuming UUID)

      if (deleteError) {
        console.error('Error deleting previous summaries:', deleteError);
      }

      // 4. Build new summaries
      const summariesToInsert = [];
      for (const parentSKU of Object.keys(grouped)) {
        const group = grouped[parentSKU];
        const parentTitle = group[0]?.parent_title || '';
        const childSKUs = group.map((c: any) => c.child_sku);
        const childTitles = group.map((c: any) => c.child_title || '');
        const childQuantities = group.map((c: any) => c.quantity);

        const childPrices = group.map((c: any) => {
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

        // Debug logging for specific problem SKU mentioned in original file
        if (parentSKU === '0X-U12R-J16J') {
          console.log('Processing problem SKU:', parentSKU);
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

      // 5. Insert data (in chunks if necessary, but supabase handles fairly large inserts)
      // If the array is massive, we might want to chunk writes, but let's stick to existing logic for now
      // The original logic just did one insert call.
      if (summariesToInsert.length > 0) {
        const { error } = await supabaseAdmin
          .from('linnworks_composition_summary')
          .insert(summariesToInsert);

        if (error) throw error;
      }

      return { success: true, message: 'Summary generated.' };

    } catch (e) {
      console.error('Error generating summary:', e);
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }
};
