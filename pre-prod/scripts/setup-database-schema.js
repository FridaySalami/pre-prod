#!/usr/bin/env node

/**
 * Database Schema Setup Script for Match Buy Box
 * Safely creates tables and indexes with proper error handling
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Supabase client
const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function setupDatabase() {
  console.log('🚀 Starting Match Buy Box database schema setup...');

  try {
    // Read the SQL file
    const sqlContent = readFileSync('./database-schema-setup.sql', 'utf8');

    // Execute the SQL
    console.log('📄 Executing database schema setup SQL...');
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sqlContent
    });

    if (error) {
      console.error('❌ Database setup failed:', error);

      // Try individual operations for better error reporting
      await setupSchemaStepByStep();
    } else {
      console.log('✅ Database schema setup completed successfully!');
      console.log('📊 Results:', data);
    }

  } catch (error) {
    console.error('❌ Setup script failed:', error);
    console.log('🔄 Attempting step-by-step setup...');
    await setupSchemaStepByStep();
  }
}

async function setupSchemaStepByStep() {
  console.log('🔧 Setting up database schema step by step...');

  const steps = [
    {
      name: 'Add product_type column to buybox_data',
      sql: `
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'buybox_data' 
                AND column_name = 'product_type'
            ) THEN
                ALTER TABLE buybox_data ADD COLUMN product_type TEXT;
                RAISE NOTICE 'Added product_type column';
            ELSE
                RAISE NOTICE 'product_type column already exists';
            END IF;
        END $$;
      `
    },
    {
      name: 'Create index on product_type',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_buybox_data_product_type ON buybox_data(product_type);
      `
    },
    {
      name: 'Create sku_product_types table',
      sql: `
        CREATE TABLE IF NOT EXISTS sku_product_types (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          sku TEXT UNIQUE NOT NULL,
          asin TEXT,
          product_type TEXT NOT NULL,
          verified_at TIMESTAMP DEFAULT NOW(),
          source TEXT DEFAULT 'amazon_api',
          marketplace_id TEXT DEFAULT 'A1F83G8C2ARO7P'
        );
      `
    },
    {
      name: 'Create indexes for sku_product_types',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_sku_product_types_sku ON sku_product_types(sku);
        CREATE INDEX IF NOT EXISTS idx_sku_product_types_asin ON sku_product_types(asin);
      `
    },
    {
      name: 'Create price_history table',
      sql: `
        CREATE TABLE IF NOT EXISTS price_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          record_id UUID REFERENCES buybox_data(id),
          sku TEXT NOT NULL,
          asin TEXT,
          old_price NUMERIC(10,2),
          new_price NUMERIC(10,2),
          change_reason TEXT DEFAULT 'match_buy_box',
          product_type TEXT,
          feed_id TEXT,
          updated_by UUID REFERENCES auth.users(id),
          success BOOLEAN DEFAULT false,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    },
    {
      name: 'Create indexes for price_history',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_price_history_sku ON price_history(sku);
        CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(created_at);
      `
    }
  ];

  for (const step of steps) {
    try {
      console.log(`📋 ${step.name}...`);

      const { error } = await supabase.rpc('exec_sql', {
        sql_query: step.sql
      });

      if (error) {
        console.error(`❌ Failed: ${step.name}`, error);
      } else {
        console.log(`✅ Success: ${step.name}`);
      }
    } catch (error) {
      console.error(`❌ Error in ${step.name}:`, error);
    }
  }

  // Verify setup
  await verifySetup();
}

async function verifySetup() {
  console.log('🔍 Verifying database setup...');

  try {
    // Check if product_type column exists
    const { data: columns } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'buybox_data' AND column_name = 'product_type';
      `
    });

    // Check if tables exist
    const { data: tables } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name IN ('sku_product_types', 'price_history');
      `
    });

    console.log('📊 Verification Results:');
    console.log('  - product_type column:', columns?.length > 0 ? '✅ EXISTS' : '❌ MISSING');
    console.log('  - sku_product_types table:', tables?.some(t => t.table_name === 'sku_product_types') ? '✅ EXISTS' : '❌ MISSING');
    console.log('  - price_history table:', tables?.some(t => t.table_name === 'price_history') ? '✅ EXISTS' : '❌ MISSING');

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Alternative method using individual queries
async function setupWithIndividualQueries() {
  console.log('🔧 Setting up with individual queries...');

  const queries = [
    {
      name: 'Add product_type column',
      query: 'ALTER TABLE buybox_data ADD COLUMN IF NOT EXISTS product_type TEXT'
    },
    {
      name: 'Create product_type index',
      query: 'CREATE INDEX IF NOT EXISTS idx_buybox_data_product_type ON buybox_data(product_type)'
    }
  ];

  for (const { name, query } of queries) {
    try {
      console.log(`📋 ${name}...`);
      const { error } = await supabase.from('buybox_data').select('*').limit(0);

      if (!error) {
        console.log(`✅ ${name} - Table accessible`);
      }
    } catch (error) {
      console.error(`❌ ${name} failed:`, error);
    }
  }
}

// Run the setup
setupDatabase().catch(console.error);
