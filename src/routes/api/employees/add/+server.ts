import { json } from '@sveltejs/kit';

export async function POST({ request, locals }) {
  const supabase = locals.supabase;
  const { name, role } = await request.json();

  if (!name || !role) {
    return json({ error: 'Missing name or role' }, { status: 400 });
  }

  try {
    // Check if exists
    const { data: existing } = await supabase
      .from('employees')
      .select('*')
      .ilike('name', name)
      .single();

    if (existing) {
      return json({ error: 'Employee already exists', employee: existing }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('employees')
      .insert({ name, role })
      .select()
      .single();

    if (error) {
      console.error('Error inserting employee:', error);
      return json({ error: error.message }, { status: 500 });
    }

    return json({ success: true, employee: data });

  } catch (e) {
    console.error('Server error creating employee:', e);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
