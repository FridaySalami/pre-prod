import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  try {
    // Generate a random state parameter for security
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // Build the Amazon authorization URL using Login with Amazon endpoint
    const redirectUri = `${url.origin}/api/amazon/oauth/callback`;

    // Try Login with Amazon endpoint with SP-API scope
    const authUrl = new URL('https://www.amazon.com/ap/oa');
    authUrl.searchParams.append('client_id', env.AMAZON_CLIENT_ID || '');
    authUrl.searchParams.append('scope', 'sellingpartnerapi::notifications sellingpartnerapi::migration');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('state', state);

    console.log('=== AMAZON OAUTH SETUP (LWA) ===');
    console.log('Redirect URI:', redirectUri);
    console.log('Client ID:', env.AMAZON_CLIENT_ID);
    console.log('Authorization URL:', authUrl.toString());
    console.log('==========================');

    return json({
      success: true,
      authUrl: authUrl.toString(),
      redirectUri: redirectUri,
      state: state,
      instructions: [
        '1. Copy the authorization URL below',
        '2. Open it in your browser',
        '3. Sign in to your Amazon account',
        '4. Authorize the application for SP-API access',
        '5. You will be redirected back with the refresh token'
      ]
    });

  } catch (error) {
    console.error('OAuth setup error:', error);
    return json({
      success: false,
      error: 'setup_error',
      errorDescription: 'An error occurred setting up OAuth'
    }, { status: 500 });
  }
};
