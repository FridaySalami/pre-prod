const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testInventoryDownload() {
  console.log('Testing inventory download functionality...');

  try {
    // Clear existing inventory
    await prisma.inventory.deleteMany();
    console.log('Cleared existing inventory data');

    // Add test inventory data
    const testInventory = [
      {
        sku: 'TEST001',
        stockLevel: 100,
        depth: 10,
        height: 5,
        width: 8,
        purchasePrice: 15.99,
        retailPrice: 29.99,
        title: 'Sample Product 1',
        tracked: true,
        weight: 0.5
      },
      {
        sku: 'TEST002',
        stockLevel: 50,
        depth: 12,
        height: 6,
        width: 10,
        purchasePrice: 25.00,
        retailPrice: 49.99,
        title: 'Sample Product 2',
        tracked: false,
        weight: 0.8
      },
      {
        sku: 'TEST003',
        stockLevel: 75,
        depth: 8,
        height: 4,
        width: 6,
        purchasePrice: 8.50,
        retailPrice: 19.99,
        title: 'Sample Product 3',
        tracked: true,
        weight: 0.3
      }
    ];

    await prisma.inventory.createMany({
      data: testInventory
    });

    console.log('Added test inventory data');

    // Test download API
    const response = await fetch('http://localhost:3001/api/inventory/download');

    if (response.ok) {
      const csvContent = await response.text();
      console.log('CSV Download successful!');
      console.log('CSV Content:');
      console.log(csvContent);

      // Save to file for verification
      const fs = require('fs');
      fs.writeFileSync('test-inventory-download.csv', csvContent);
      console.log('CSV saved to test-inventory-download.csv');
    } else {
      console.error('Download failed:', response.status, response.statusText);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testInventoryDownload();
