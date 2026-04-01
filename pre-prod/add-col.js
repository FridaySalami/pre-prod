import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await pool.query('ALTER TABLE inventory ADD COLUMN IF NOT EXISTS preferred_box TEXT;');
    console.log('Added preferred_box to inventory');
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
