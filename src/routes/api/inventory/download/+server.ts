import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const searchParams = url.searchParams;

    // Extract filter parameters
    const search = searchParams.get('search') || '';
    const tracked = searchParams.get('tracked') || '';
    const minPrice = searchParams.get('minPrice') || '';
    const maxPrice = searchParams.get('maxPrice') || '';
    const priceRange = searchParams.get('priceRange') || '';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build Supabase query
    let query = supabaseAdmin.from('inventory').select('*');

    // Apply filters
    if (search) {
      query = query.or(`sku.ilike.%${search}%,title.ilike.%${search}%`);
    }

    if (tracked) {
      query = query.eq('tracked', tracked === 'true');
    }

    // Handle price range filter
    if (priceRange) {
      const [min, max] = priceRange.split('-').map(p => p === '+' ? null : parseFloat(p));
      if (min !== null) {
        query = query.gte('retail_price', min);
      }
      if (max !== null) {
        query = query.lte('retail_price', max);
      }
    }

    // Handle individual price filters
    if (minPrice) {
      query = query.gte('retail_price', parseFloat(minPrice));
    }

    if (maxPrice) {
      query = query.lte('retail_price', parseFloat(maxPrice));
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Fetch all matching inventory items (no pagination for download)
    const { data: inventory, error } = await query;

    if (error) throw error;

    // Convert to CSV format
    const csvHeaders = [
      'SKU',
      'Stock Level',
      'Depth',
      'Height',
      'Width',
      'Purchase Price',
      'Retail Price',
      'Title',
      'Tracked',
      'Weight'
    ];

    const csvRows = inventory.map((item: any) => [
      item.sku || '',
      item.stock_level || 0,
      item.depth || 0,
      item.height || 0,
      item.width || 0,
      item.purchase_price || 0,
      item.retail_price || 0,
      item.title || '',
      item.tracked ? 'Yes' : 'No',
      item.weight || 0
    ]);

    // Create CSV content
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map((row: any[]) => row.map((field: any) =>
        typeof field === 'string' && field.includes(',')
          ? `"${field.replace(/"/g, '""')}"`
          : field
      ).join(','))
    ].join('\n');

    // Return CSV response
    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="inventory_export_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });

  } catch (error) {
    console.error('Error exporting inventory:', error);
    return json(
      { error: 'Failed to export inventory' },
      { status: 500 }
    );
  }
};
