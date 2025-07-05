import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Test TypeScript recognition
async function testInventory() {
  const items = await prisma.inventory.findMany();
  console.log(items);
}

export { testInventory };
