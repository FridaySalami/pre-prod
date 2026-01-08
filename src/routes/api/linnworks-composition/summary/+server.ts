// src/routes/api/linnworks-composition/summary/+server.ts
import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';
import { linnworksCompositionService } from '$lib/services/linnworksCompositionService';

export async function POST() {
  try {
    const result = await linnworksCompositionService.generateSummary();
    if (!result.success) {
      return json({ success: false, error: result.error }, { status: 500 });
    }
    return json(result);
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
