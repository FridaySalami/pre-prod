import { json } from '@sveltejs/kit';

export async function POST({ request, locals }) {
  const supabase = locals.supabase;
  const { id } = await request.json();

  if (!id) {
    return json({ error: 'Missing employee ID' }, { status: 400 });
  }

  try {
    // 1. Delete associated holidays first
    const { error: holidaysError } = await supabase
      .from('holidays')
      .delete()
      .eq('internal_employee_id', id);

    if (holidaysError) {
      console.error('Error deleting employee holidays:', holidaysError);
      return json({ error: 'Failed to cleanup employee holidays: ' + holidaysError.message }, { status: 500 });
    }

    // 2. Delete the employee
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting employee:', error);
      return json({ error: error.message }, { status: 500 });
    }

    return json({ success: true });
  } catch (e: any) {
    console.error('Error in delete employee endpoint:', e);
    return json({ error: e.message }, { status: 500 });
  }
}
