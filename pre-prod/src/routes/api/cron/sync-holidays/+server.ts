/**
 * Cron Job: Sync Holidays from MyHRToolkit
 * 
 * Authentication: Requires Authorization: Bearer <CRON_SECRET> header
 */

import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import axios from 'axios';

export async function POST({ request }) {
  // 1. Authentication Check
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Initialize Supabase Service Client (Bypass RLS)
  if (!PUBLIC_SUPABASE_URL || !env.PRIVATE_SUPABASE_SERVICE_KEY) {
    return json({ error: 'Server configuration error' }, { status: 500 });
  }

  const supabase = createClient(PUBLIC_SUPABASE_URL, env.PRIVATE_SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // 3. Check MyHRToolkit Credentials
  const clientId = env.MYHRTOOLKIT_CLIENT_ID;
  const clientSecret = env.MYHRTOOLKIT_CLIENT_SECRET;
  const apiUrl = env.MYHRTOOLKIT_API_URL;

  if (!clientId || !clientSecret || !apiUrl) {
    return json({ error: 'Missing MYHRTOOLKIT credentials or API URL' }, { status: 500 });
  }

  try {
    // 4. Authenticate with MyHRToolkit
    const tokenUrl = `${apiUrl}/oauth/access_token`;
    const authBody = `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;

    const authResponse = await axios.post(tokenUrl, authBody, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'cache-control': 'no-cache'
      }
    });

    const { access_token } = authResponse.data;

    // 5. Fetch Internal Employees for Matching
    const { data: employees } = await supabase.from('employees').select('id, name');
    const employeeMap = new Map();
    if (employees) {
      employees.forEach(emp => {
        if (emp.name) employeeMap.set(emp.name.toLowerCase().trim(), emp.id);
      });
    }

    // 6. Fetch Holidays (Current Year + Next Year)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yearsToFetch = new Set([today.getFullYear(), today.getFullYear() + 1]);
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

          const holidays = Array.isArray(responseData) ? responseData : (responseData.data || []);
          if (Array.isArray(holidays)) {
            allHolidays = [...allHolidays, ...holidays];
          }

          if (responseData.meta && responseData.meta.pagination) {
            totalPages = responseData.meta.pagination.total_pages;
          } else {
            totalPages = 1;
          }

          page++;
        }
      } catch (e) {
        console.error(`Failed to fetch holidays for year ${year}`, e);
      }
    }

    if (allHolidays.length === 0) {
      return json({ message: 'No holidays found or API error', count: 0 });
    }

    // 7. Save to Supabase
    const upsertData = allHolidays.map(h => {
      const internalId = h.employee_name ? employeeMap.get(h.employee_name.toLowerCase().trim()) : null;

      return {
        id: h.id,
        user_id: h.user_id,
        internal_employee_id: internalId,
        employee_name: h.employee_name,
        from_date: h.from,
        to_date: h.to,
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
      message: `Successfully synced ${allHolidays.length} holidays`,
      count: allHolidays.length
    });

  } catch (err: any) {
    console.error('Cron job error:', err);
    return json({
      error: 'Sync process failed',
      details: err.message
    }, { status: 500 });
  }
}
