
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

// Load .env
dotenv.config();

const { Client } = pg;

async function deploySql() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false } // Required for Supabase in many cases
  });

  try {
    await client.connect();
    console.log('✅ Connected to database.');

    const sqlPath = path.join(process.cwd(), 'sql', 'create_apply_order_packaging_usage.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🚀 Executing SQL...');
    await client.query(sql);

    console.log('✅ SQL executed successfully.');
  } catch (err) {
    console.error('❌ Error executing SQL:', err);
  } finally {
    await client.end();
  }
}

deploySql();
