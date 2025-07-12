import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  try {
    // Generate a random state parameter for security
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // Build the Amazon authorization URL - Try SP-API specific endpoint
    const redirectUri = `${url.origin}/api/amazon/oauth/callback`;

    // Try the SP-API authorization endpoint instead of general LWA
    const authUrl = new URL('https://sellercentral.amazon.co.uk/apps/authorize/consent');
    authUrl.searchParams.append('application_id', env.AMAZON_CLIENT_ID || '');
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('version', 'beta');
    authUrl.searchParams.append('scope', 'sellingpartnerapi::notifications sellingpartnerapi::migration');

    console.log('=== AMAZON OAUTH SETUP ===');
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
        '3. Sign in to your Amazon Seller Central account',
        '4. Authorize the application',
        '5. You will be redirected back with the refresh token'
      ]
    });

  } catch (error) {
    console.error('OAuth initiation error:', error);
    return json({
      success: false,
      error: 'oauth_init_error',
      errorDescription: 'Failed to generate authorization URL'
    }, { status: 500 });
  }
};
