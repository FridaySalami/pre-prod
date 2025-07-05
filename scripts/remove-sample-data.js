const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function removeSampleData() {
  try {
    console.log('Removing sample data...');
    const result = await prisma.product.deleteMany({
      where: {
        sku: {
          in: ['TEST001', 'TEST002', 'TEST003']
        }
      }
    });
    console.log('Removed', result.count, 'sample products');

    const totalProducts = await prisma.product.count();
    console.log('Total products remaining:', totalProducts);

    // Show a sample of real products
    const sampleProducts = await prisma.product.findMany({
      take: 3,
      select: {
        sku: true,
        name: true,
        cost: true,
        listPrice: true,
        stockLevel: true
      }
    });

    console.log('Sample of your real products:');
    sampleProducts.forEach(p => {
      console.log(`- ${p.sku}: ${p.name} (Cost: $${p.cost}, Price: $${p.listPrice}, Stock: ${p.stockLevel})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

removeSampleData();
