const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function importSampleData() {
  try {
    console.log('Starting sample data import...');

    // Read the CSV file
    const csvPath = path.join(__dirname, '../sample-inventory.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());

    // Skip header row
    const dataLines = lines.slice(1);

    console.log(`Found ${dataLines.length} products to import`);

    for (const line of dataLines) {
      if (!line.trim()) continue;

      const [sku, stockLevel, depth, height, width, purchasePrice, retailPrice, title, tracked, weight] =
        line.split(',').map(field => field.trim());

      const product = {
        sku: sku,
        name: title,
        stockLevel: parseInt(stockLevel) || 0,
        dimensions: `${depth}x${height}x${width}`,
        cost: parseFloat(purchasePrice) || 0,
        listPrice: parseFloat(retailPrice) || 0,
        weight: parseFloat(weight) || 0,
        active: tracked.toLowerCase() === 'yes',
        category: 'Sample',
        supplier: 'Sample Supplier'
      };

      try {
        // Use upsert to avoid duplicates
        await prisma.product.upsert({
          where: { sku: product.sku },
          update: product,
          create: product
        });
        console.log(`✓ Imported ${product.sku}: ${product.name}`);
      } catch (error) {
        console.error(`✗ Failed to import ${product.sku}:`, error.message);
      }
    }

    console.log('Sample data import completed!');

    // Show summary
    const totalProducts = await prisma.product.count();
    console.log(`Total products in database: ${totalProducts}`);

  } catch (error) {
    console.error('Error importing sample data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importSampleData();
