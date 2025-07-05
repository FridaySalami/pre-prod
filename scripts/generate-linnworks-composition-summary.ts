// scripts/generate-linnworks-composition-summary.ts
// Script to generate LinnworksCompositionSummary from LinnworksComposition and SageReport

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Fetch all compositions and SageReport data
  const compositions = await prisma.linnworksComposition.findMany();
  const sageReports = await prisma.sageReport.findMany();
  const sageBySku = Object.fromEntries(sageReports.map(s => [s.stockCode, s]));

  // Group by parentSKU
  const grouped: Record<string, typeof compositions> = {};
  for (const comp of compositions) {
    if (!grouped[comp.parentSKU]) grouped[comp.parentSKU] = [];
    grouped[comp.parentSKU].push(comp);
  }

  // Remove all previous summaries
  await prisma.linnworksCompositionSummary.deleteMany({});

  // For each parentSKU, build summary
  for (const parentSKU of Object.keys(grouped)) {
    const group = grouped[parentSKU];
    const parentTitle = group[0]?.parentTitle || '';
    const childSKUs = group.map(c => c.childSKU);
    const childTitles = group.map(c => c.childTitle || '');
    const childQuantities = group.map(c => c.quantity);
    const childPrices = group.map(c => {
      const sage = sageBySku[c.childSKU];
      return sage?.price ?? null;
    });
    const childVATs = group.map(c => {
      const sage = sageBySku[c.childSKU];
      return sage?.taxRate ?? null;
    });
    // Qty for parent
    const totalQty = group.reduce((sum, c) => sum + (c.quantity || 0), 0);
    // Total value: sum of (child price * quantity)
    const totalValue = group.reduce((sum, c) => {
      const price = sageBySku[c.childSKU]?.price ?? 0;
      return sum + price * (c.quantity || 0);
    }, 0);

    await prisma.linnworksCompositionSummary.create({
      data: {
        parentSKU,
        parentTitle,
        childSKUs: JSON.stringify(childSKUs),
        childTitles: JSON.stringify(childTitles),
        childQuantities: JSON.stringify(childQuantities),
        childPrices: JSON.stringify(childPrices),
        childVATs: JSON.stringify(childVATs),
        totalQty,
        totalValue,
      },
    });
  }

  console.log('LinnworksCompositionSummary generated.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
