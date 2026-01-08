
import { linnworksCompositionService } from './src/lib/services/linnworksCompositionService.js';
import { db } from './src/lib/supabaseServer.js';

async function run() {
  console.log('Fetching WRA01 from sage_reports...');
  const { data: sage } = await db.from('sage_reports').select('*').eq('stock_code', 'WRA01');
  console.log('Sage Report WRA01:', sage);

  console.log('Running generateSummary...');
  await linnworksCompositionService.generateSummary();
  console.log('Done.');

  console.log('Fetching WRA01 from linnworks_composition_summary...');
  const { data: summary } = await db.from('linnworks_composition_summary').select('*').eq('parent_sku', 'WRA01');
  console.log('Summary WRA01:', summary);
}

run();
