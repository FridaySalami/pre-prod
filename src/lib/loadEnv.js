import { readFileSync } from 'fs';
import { resolve } from 'path';

let envLoaded = false;

export function loadEnvVariables() {
  if (envLoaded) return;

  try {
    const envPath = resolve(process.cwd(), '.env');
    const envContent = readFileSync(envPath, 'utf8');

    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value;
        }
      }
    });

    envLoaded = true;
    console.log('✅ Environment variables loaded from .env file');
  } catch (error) {
    console.error('❌ Failed to load .env file:', error instanceof Error ? error.message : String(error));
  }
}
