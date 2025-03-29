// routes/api/scheduled-hours/+server.ts
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export async function GET({ url }) {
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  
  if (!startDate || !endDate) {
    return new Response(JSON.stringify({ error: 'Start and end dates are required' }), { status: 400 });
  }
  
  try {
    const { data, error } = await supabase
      .from('scheduled_hours')
      .select('date, hours')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date');
      
    if (error) throw error;
    
    return json(data || []);
  } catch (err) {
    console.error('Error fetching scheduled hours:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}