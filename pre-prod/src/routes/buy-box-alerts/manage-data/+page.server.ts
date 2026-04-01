import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url }) => {
  const page = Number(url.searchParams.get('page')) || 1;
  const pageSize = Number(url.searchParams.get('pageSize')) || 20;
  const search = url.searchParams.get('search') || '';

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = locals.supabase
    .from('buybox_data')
    .select('id, asin, sku, item_name, price, min_profitable_price, opportunity_flag, captured_at, is_winner, competitor_name, your_current_price, margin_percent_at_buybox, recommended_action, your_offers_count, profit_opportunity', { count: 'exact' });

  if (search) {
    query = query.or(`asin.ilike.%${search}%,sku.ilike.%${search}%,item_name.ilike.%${search}%`);
  }

  const { data, error, count } = await query
    .order('captured_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching buybox data:', error);
    return {
      buyboxData: [],
      count: 0,
      page,
      pageSize,
      search
    };
  }

  return {
    buyboxData: data,
    count: count || 0,
    page,
    pageSize,
    search
  };
};

export const actions: Actions = {
  update: async ({ request, locals }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const field = formData.get('field') as string;
    const value = formData.get('value') as string;

    if (!id || !field) {
      return fail(400, { message: 'Missing id or field' });
    }

    // Basic validation could be added here

    const { error } = await locals.supabase
      .from('buybox_data')
      .update({ [field]: value })
      .eq('id', id);

    if (error) {
      return fail(500, { message: 'Failed to update data', error: error.message });
    }

    return { success: true };
  }
};
