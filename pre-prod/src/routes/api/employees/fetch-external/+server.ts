import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import axios from 'axios';

export async function POST({ locals }) {
  const supabase = locals.supabase;

  // 1. Check Env Vars
  const clientId = env.MYHRTOOLKIT_CLIENT_ID;
  const clientSecret = env.MYHRTOOLKIT_CLIENT_SECRET;
  const apiUrl = env.MYHRTOOLKIT_API_URL;

  if (!clientId || !clientSecret || !apiUrl) {
    return json({ error: 'Missing MYHRTOOLKIT credentials or API URL' }, { status: 500 });
  }

  try {
    // 2. Authenticate
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

    // 3. Fetch Users
    const usersUrl = `${apiUrl}/public/users`;
    const usersResponse = await axios.get(usersUrl, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json'
      }
    });

    const startUsers = usersResponse.data.data;
    console.log(`Fetched ${startUsers ? startUsers.length : 0} users from MyHRToolkit`);

    if (startUsers && startUsers.length > 0) {
      console.log('Sample user structure:', JSON.stringify(startUsers[0], null, 2));
    }

    if (!startUsers || !Array.isArray(startUsers)) {
      console.warn('MyHRToolkit returned unexpected data format:', usersResponse.data);
      return json({ users: [] });
    }

    // Sort logic
    const users = startUsers.sort((a: any, b: any) => {
      const nameA = `${a.surname} ${a.firstname}`;
      const nameB = `${b.surname} ${b.firstname}`;
      return nameA.localeCompare(nameB);
    });

    // 4. Return user list
    return json({ users });

  } catch (error: any) {
    console.error('Error fetching MyHR users:', error?.response?.data || error.message);
    if (error?.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
    const errorMessage = error?.response?.data?.error || error.message || 'Failed to fetch users from MyHRToolkit';
    return json({ error: errorMessage }, { status: error?.response?.status || 500 });
  }
}
