import { json } from '@sveltejs/kit';

export async function GET({ locals }) {
  const supabase = locals.supabase;

  try {
    const { data: employees, error } = await supabase
      .from('employees')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching tracked employees:', error);
      return json({ error: error.message }, { status: 500 });
    }

    return json({ employees });
  } catch (e: any) {
    console.error('Error in employees list endpoint:', e);
    return json({ error: e.message }, { status: 500 });
  }
}
