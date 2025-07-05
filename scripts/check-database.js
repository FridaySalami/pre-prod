const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('Checking database structure...');

    // Check if Product table exists and has data
    try {
      const productCount = await prisma.product.count();
      console.log('Products in Product table:', productCount);

      if (productCount > 0) {
        const sample = await prisma.product.findFirst();
        console.log('Sample product:', sample);
      }
    } catch (e) {
      console.log('Error with Product table:', e.message);
    }

    // Let's also check what other models might exist
    console.log('Checking for other possible tables...');

    // Check database type from connection string
    console.log('Database URL type:', process.env.DATABASE_URL ? 'Set' : 'Not set');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
