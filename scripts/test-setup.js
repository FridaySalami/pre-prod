#!/usr/bin/env node

/**
 * Test script for the database setup and import service
 */

import { importFromFile } from '../src/lib/services/dataImportUpdated.ts';
import prisma from '../src/lib/database/prisma.ts';

async function testSetup() {
  console.log('🧪 Testing database setup...\n');

  try {
    // 1. Test database connection
    console.log('📊 Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connected successfully\n');

    // 2. Test data import
    console.log('📥 Testing data import...');
    const importResult = await importFromFile('./test-data.json', 'sage');

    if (importResult.success) {
      console.log(`✅ Import successful: ${importResult.imported} products imported`);
      if (importResult.errors.length > 0) {
        console.log(`⚠️  ${importResult.errors.length} errors:`, importResult.errors);
      }
    } else {
      console.log('❌ Import failed:', importResult.errors);
      return;
    }

    console.log('');

    // 3. Test database queries
    console.log('🔍 Testing database queries...');
    const products = await prisma.product.findMany({
      take: 3,
      include: {
        imports: true
      }
    });

    console.log(`✅ Found ${products.length} products in database:`);
    products.forEach(product => {
      console.log(`  - ${product.sku}: ${product.name} ($${product.cost})`);
    });

    console.log('');

    // 4. Test pricing service
    console.log('💰 Testing pricing service...');
    if (products.length > 0) {
      const firstProduct = products[0];

      // Create a simple pricing rule first
      const pricingRule = await prisma.pricingRule.create({
        data: {
          name: 'Test Electronics Markup',
          description: 'Higher markup for electronics',
          ruleType: 'category',
          condition: JSON.stringify({ category: 'electronics' }),
          action: JSON.stringify({ setMarkup: 45 }),
          priority: 1,
          active: true
        }
      });

      console.log(`✅ Created pricing rule: ${pricingRule.name}`);
    }

    console.log('');

    // 5. Test import history
    console.log('📋 Testing import history...');
    const importService = new (await import('../src/lib/services/dataImportUpdated.ts')).DataImportService();
    const history = await importService.getImportHistory();

    console.log(`✅ Found ${history.length} import records:`);
    history.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.filename} (${record.status}) - ${record.recordsProcessed}/${record.recordsTotal} records`);
    });

    console.log('\n🎉 All tests passed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testSetup();
