#!/usr/bin/env node

/**
 * Supabase Migration Runner
 * Executes SQL migration files directly on the database
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

async function runMigrations() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database\n');

    // Migration files in order
    const migrations = [
      '20250127000001_create_amazon_catalog_cache.sql',
      '20250127000002_create_amazon_fees_cache.sql'
    ];

    for (const migrationFile of migrations) {
      console.log(`📄 Running migration: ${migrationFile}`);
      const migrationPath = join(__dirname, 'supabase', 'migrations', migrationFile);

      try {
        const sql = readFileSync(migrationPath, 'utf8');
        await client.query(sql);
        console.log(`✅ Successfully executed ${migrationFile}\n`);
      } catch (error) {
        console.error(`❌ Error executing ${migrationFile}:`, error.message);
        throw error;
      }
    }

    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('amazon_catalog_cache', 'amazon_fees_cache')
      ORDER BY table_name;
    `);

    console.log('✅ Tables created:');
    result.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // Verify indexes
    console.log('\n🔍 Verifying indexes...');
    const indexResult = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename IN ('amazon_catalog_cache', 'amazon_fees_cache')
      ORDER BY tablename, indexname;
    `);

    console.log('✅ Indexes created:');
    indexResult.rows.forEach(row => {
      console.log(`   - ${row.tablename}.${row.indexname}`);
    });

    console.log('\n🎉 All migrations completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

runMigrations();
