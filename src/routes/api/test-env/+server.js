import { json } from '@sveltejs/kit';
import { loadEnvVariables } from '$lib/loadEnv';

// Load environment variables for development
loadEnvVariables();

export async function GET() {
  // Debug: Show all environment variables that start with AMAZON_
  const allEnv = Object.create(null);
  Object.keys(process.env)
    .filter(key => key.includes('AMAZON'))
    .forEach(key => {
      allEnv[key] = process.env[key] ? 'Set' : 'Missing';
    });

  const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    allAmazonVars: allEnv,
    AMAZON_AWS_ACCESS_KEY_ID: process.env.AMAZON_AWS_ACCESS_KEY_ID ? 'Set' : 'Missing',
    AMAZON_AWS_SECRET_ACCESS_KEY: process.env.AMAZON_AWS_SECRET_ACCESS_KEY ? 'Set' : 'Missing',
    AMAZON_REFRESH_TOKEN: process.env.AMAZON_REFRESH_TOKEN ? 'Set' : 'Missing',
    AMAZON_CLIENT_ID: process.env.AMAZON_CLIENT_ID ? 'Set' : 'Missing',
    AMAZON_CLIENT_SECRET: process.env.AMAZON_CLIENT_SECRET ? 'Set' : 'Missing',
  };

  return json(envVars);
}
