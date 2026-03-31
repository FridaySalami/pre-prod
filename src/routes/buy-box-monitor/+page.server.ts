import { supabase } from '$lib/supabase/supabaseClient';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  // Fetch monitored SKUs first
  const { data: monitored, error: monitoredError } = await supabase
    .from('monitored_top_100_skus')
    .select('*')
    .order('rank', { ascending: true });

  // Fetch current status
  const { data: current, error: currentError } = await supabase
    .from('top_100_buy_box_current')
    .select('*');

  // Manual join for dashboard
  const currentStatus = (monitored || []).map(m => ({
    ...m,
    ...(current?.find(c => c.sku === m.sku) || { status: 'PENDING' })
  }));

  // Stats from the merged data
  const stats = {
    total: currentStatus.length,
    winning: currentStatus.filter(m => m.is_winner).length,
    losing: currentStatus.filter(m => m.status === 'LOSING').length,
    suppressed: currentStatus.filter(m => m.status === 'SUPPRESSED').length,
    atRisk: currentStatus.filter(m => !m.is_winner && m.status !== 'WINNING' && m.status !== 'PENDING').length,
  };

  // Check last run status
  const { data: lastRun } = await supabase
    .from('buy_box_monitor_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  return {
    currentStatus: currentStatus || [],
    stats,
    lastRun,
    error: monitoredError?.message || currentError?.message || null
  };
};
