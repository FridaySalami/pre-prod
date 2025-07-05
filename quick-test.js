/**
 * Quick test script to verify the import functionality
 */
import { importFromFile } from './src/lib/services/dataImport.js';
import prisma from './src/lib/prisma.js';

async function quickTest() {
  console.log('🧪 Quick database test...');

  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');

    // Test import
    console.log('📥 Testing import...');
    const result = await importFromFile('./test-data.json', 'sage');

    if (result.success) {
      console.log(`✅ Import successful: ${result.imported} products`);

      // Show imported products
      const products = await prisma.product.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' }
      });

      console.log('📦 Recent products:');
      products.forEach(p => console.log(`  - ${p.sku}: ${p.name} ($${p.cost})`));
    } else {
      console.log('❌ Import failed:', result.errors);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

quickTest();
