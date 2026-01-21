import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import axios from 'axios';

export async function POST({ locals }) {
  const supabase = locals.supabase;

  // 1. Check Env Vars
  const clientId = env.MYHRTOOLKIT_CLIENT_ID;
  const clientSecret = env.MYHRTOOLKIT_CLIENT_SECRET;
  const apiUrl = env.MYHRTOOLKIT_API_URL || 'https://api.myhrtoolkit.com';

  if (!clientId || !clientSecret) {
    return json({ error: 'Missing MYHRTOOLKIT credentials' }, { status: 500 });
  }

  try {
    // 2. Authenticate
    const tokenUrl = `${apiUrl}/oauth/access_token`;
    // Using manual string body as per successful test script
    const authBody = `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;

    const authResponse = await axios.post(tokenUrl, authBody, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'cache-control': 'no-cache'
      }
    });

    const { access_token } = authResponse.data;

    // 2.1 Fetch Internal Employees for Matching
    const { data: employees } = await supabase.from('employees').select('id, name');
    const employeeMap = new Map();
    if (employees) {
      employees.forEach(emp => {
        if (emp.name) employeeMap.set(emp.name.toLowerCase().trim(), emp.id);
      });
    }

    // 3. Fetch Holidays (Next 6 months only)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    const futureDate = new Date(today);
    futureDate.setMonth(today.getMonth() + 6);

    // Calculate unique years to fetch
    const yearsToFetch = new Set([today.getFullYear(), futureDate.getFullYear()]);
    let allHolidays: any[] = [];

    for (const year of yearsToFetch) {
      try {
        let page = 1;
        let totalPages = 1;

        while (page <= totalPages) {
          const holidaysResponse = await axios.get(`${apiUrl}/public/holidays`, {
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Accept': 'application/json'
            },
            params: { year, page }
          });

          const responseData = holidaysResponse.data;

          // Handle data array
          const holidays = Array.isArray(responseData) ? responseData : (responseData.data || []);
          if (Array.isArray(holidays)) {
            allHolidays = [...allHolidays, ...holidays];
          }

          // Update pagination info
          if (responseData.meta && responseData.meta.pagination) {
            totalPages = responseData.meta.pagination.total_pages;
          } else {
            // If no pagination meta, assume single page
            totalPages = 1;
          }

          page++;
        }
      } catch (e) {
        console.error(`Failed to fetch holidays for year ${year}`, e);
        // Continue to next year
      }
    }

    if (allHolidays.length === 0) {
      return json({ message: 'No holidays found or API error', count: 0 });
    }

    // Filter: Future dates up to 6 months from today
    // Include holidays that haven't ended yet (end date >= today)
    // And start within the next 6 months
    const filteredHolidays = allHolidays.filter(h => {
      const holidayEnd = new Date(h.to);
      const holidayStart = new Date(h.from);
      return holidayEnd >= today && holidayStart <= futureDate;
    });

    // 4. Save to Supabase
    // Transform data to match our schema if needed, but our schema matches the API fields mostly
    const upsertData = filteredHolidays.map(h => {
      const internalId = h.employee_name ? employeeMap.get(h.employee_name.toLowerCase().trim()) : null;

      return {
        id: h.id,
        user_id: h.user_id,
        internal_employee_id: internalId, // Matched ID
        employee_name: h.employee_name,
        from_date: h.from, // API returns 'from', we mapped to 'from_date' in SQL
        to_date: h.to,     // API returns 'to'
        duration: h.duration?.toString(),
        units: h.units,
        notes: h.notes,
        status: h.status,
        date_holiday_requested_to_be_withdrawn: h.date_holiday_requested_to_be_withdrawn,
        dates_to_exclude: h.dates_to_exclude,
        raw_data: h,
        updated_at: new Date().toISOString()
      };
    });

    const { error: upsertError } = await supabase
      .from('holidays')
      .upsert(upsertData, { onConflict: 'id' });

    if (upsertError) {
      console.error('Supabase Upsert Error:', upsertError);
      return json({ error: 'Failed to save to database', details: upsertError }, { status: 500 });
    }

    return json({
      success: true,
      message: `Successfully synced ${filteredHolidays.length} holidays`,
      count: filteredHolidays.length
    });

  } catch (err: any) {
    console.error('Sync Error:', err);
    return json({
      error: 'Sync process failed',
      details: err.message,
      response: err.response?.data
    }, { status: 500 });
  }
}
