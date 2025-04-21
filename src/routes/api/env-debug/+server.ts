import { json } from '@sveltejs/kit';
import * as env from '$env/static/private';

export async function GET() {
  // Only use in development mode
  if (process.env.NODE_ENV !== 'development') {
    return json({ error: 'Only available in development mode' });
  }
  
  // Check what environment variables are available
  const availableEnvs = Object.keys(env);
  
  // Check for specific variables (safely)
  const linnworksAppIdExists = 'LINNWORKS_APP_ID' in env;
  const linnworksSecretExists = 'LINNWORKS_APP_SECRET' in env;
  
  // Return a safe summary (don't expose actual values)
  return json({
    availableEnvVars: availableEnvs,
    linnworksAppIdExists,
    linnworksSecretExists,
    // Show first few chars of keys if they exist
    linnworksAppIdPrefix: linnworksAppIdExists ? env.LINNWORKS_APP_ID.substring(0, 4) + '...' : 'N/A',
    linnworksSecretPrefix: linnworksSecretExists ? env.LINNWORKS_APP_SECRET.substring(0, 4) + '...' : 'N/A',
  });
}