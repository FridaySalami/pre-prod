import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch }) => {
  try {
    const authorizationCode = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('Amazon OAuth Error:', error, errorDescription);
      return json({
        success: false,
        error: error,
        errorDescription: errorDescription
      }, { status: 400 });
    }

    // Validate that we received an authorization code
    if (!authorizationCode) {
      return json({
        success: false,
        error: 'missing_authorization_code',
        errorDescription: 'No authorization code received from Amazon'
      }, { status: 400 });
    }

    // Exchange authorization code for refresh token
    const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authorizationCode,
        redirect_uri: `${url.origin}/api/amazon/oauth/callback`,
        client_id: env.AMAZON_CLIENT_ID!,
        client_secret: env.AMAZON_CLIENT_SECRET!
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData);
      return json({
        success: false,
        error: 'token_exchange_failed',
        errorDescription: tokenData.error_description || 'Failed to exchange authorization code for tokens',
        details: tokenData
      }, { status: 400 });
    }

    // Log the refresh token (you'll need to save this to your .env file)
    console.log('=== AMAZON OAUTH SUCCESS ===');
    console.log('Refresh Token:', tokenData.refresh_token);
    console.log('Access Token:', tokenData.access_token);
    console.log('Token Type:', tokenData.token_type);
    console.log('Expires In:', tokenData.expires_in);
    console.log('================================');

    // Return success response with instructions
    return json({
      success: true,
      message: 'OAuth flow completed successfully!',
      instructions: 'Check your server console for the refresh token and add it to your .env file',
      refreshToken: tokenData.refresh_token,
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    return json({
      success: false,
      error: 'callback_error',
      errorDescription: 'An error occurred processing the OAuth callback'
    }, { status: 500 });
  }
};
