import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL in .env file');
  process.exit(1);
}

const sqlPath = path.resolve('sql/setup-top-100-buybox.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected.');

    console.log('Executing SQL from sql/setup-top-100-buybox.sql...');
    await client.query(sql);
    
    console.log('✅ Database setup completed successfully.');
  } catch (err) {
    console.error('❌ Database error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
