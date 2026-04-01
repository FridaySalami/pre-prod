/**
 * Amazon Sales Data Analysis for ASIN B07H1HW13V
 * Analyzing the CSV data from Amazon Business Reports
 */

// Raw data from Amazon Business Reports CSV
const asinData = {
  parentASIN: 'B07H1HW13V',
  childASIN: 'B07H1HW13V',
  title: 'Puro Balsamic Glaze 500ml',
  sku: 'VIN04B',

  // Traffic Data
  sessions: {
    mobileApp: 255,
    mobileAppB2B: 4,
    browser: 172,
    browserB2B: 2,
    total: 427,
    totalB2B: 6
  },

  // Session Percentages (market share)
  sessionPercentage: {
    mobileApp: '0.02%',
    mobileAppB2B: '0.02%',
    browser: '0.01%',
    browserB2B: '0.00%',
    total: '0.02%',
    totalB2B: '0.01%'
  },

  // Page Views
  pageViews: {
    mobileApp: 387,
    mobileAppB2B: 4,
    browser: 247,
    browserB2B: 2,
    total: 634,
    totalB2B: 6
  },

  // Page View Percentages
  pageViewPercentage: {
    mobileApp: '0.02%',
    mobileAppB2B: '0.02%',
    browser: '0.02%',
    browserB2B: '0.00%',
    total: '0.02%',
    totalB2B: '0.00%'
  },

  // Buy Box Performance
  buyBoxPercentage: '97.82%',
  buyBoxPercentageB2B: '100.00%',

  // Sales Performance
  unitsOrdered: 122,
  unitsOrderedB2B: 4,
  unitSessionPercentage: '28.57%', // Conversion rate
  unitSessionPercentageB2B: '66.67%',

  // Revenue
  orderedProductSales: '£856.78',
  orderedProductSalesB2B: '£28.64',

  // Order Items
  totalOrderItems: 115,
  totalOrderItemsB2B: 2
};

console.log('📊 AMAZON SALES ANALYSIS: ASIN B07H1HW13V');
console.log('═'.repeat(70));
console.log(`Product: ${asinData.title}`);
console.log(`SKU: ${asinData.sku}`);
console.log(`ASIN: ${asinData.parentASIN}`);
console.log('');

console.log('🛒 SALES PERFORMANCE (Last 7 Days)');
console.log('─'.repeat(70));
console.log(`Total Units Sold: ${asinData.unitsOrdered}`);
console.log(`  ↳ B2B Units (subset): ${asinData.unitsOrderedB2B}`);
console.log(`  ↳ Consumer Units: ${asinData.unitsOrdered - asinData.unitsOrderedB2B}`);
console.log('');
console.log(`Total Revenue: ${asinData.orderedProductSales}`);
console.log(`  ↳ B2B Revenue (subset): ${asinData.orderedProductSalesB2B}`);

// Calculate total revenue (B2B is subset of total, not additive)
const totalRevenue = parseFloat(asinData.orderedProductSales.replace('£', '').replace(',', ''));
const b2bRevenue = parseFloat(asinData.orderedProductSalesB2B.replace('£', '').replace(',', ''));
const consumerRevenue = totalRevenue - b2bRevenue;

console.log(`  ↳ Consumer Revenue: £${consumerRevenue.toFixed(2)}`);
console.log('');

// Calculate average order value
const totalUnits = asinData.unitsOrdered;
const avgOrderValue = totalRevenue / totalUnits;
console.log(`Average Price per Unit: £${avgOrderValue.toFixed(2)}`);
console.log('');

console.log('👑 BUY BOX PERFORMANCE');
console.log('─'.repeat(70));
console.log(`Buy Box Ownership (Consumer): ${asinData.buyBoxPercentage}`);
console.log(`Buy Box Ownership (B2B): ${asinData.buyBoxPercentageB2B}`);
console.log('✅ Excellent Buy Box control!');
console.log('');

console.log('📈 TRAFFIC & CONVERSION');
console.log('─'.repeat(70));
console.log(`Total Sessions: ${asinData.sessions.total}`);
console.log(`Total Page Views: ${asinData.pageViews.total}`);
console.log(`Conversion Rate (Consumer): ${asinData.unitSessionPercentage}`);
console.log(`Conversion Rate (B2B): ${asinData.unitSessionPercentageB2B}`);
console.log('');

// Calculate pages per session
const pagesPerSession = (asinData.pageViews.total / asinData.sessions.total).toFixed(2);
console.log(`Pages per Session: ${pagesPerSession}`);
console.log('');

console.log('📱 TRAFFIC BREAKDOWN');
console.log('─'.repeat(70));
console.log(`Mobile App Sessions: ${asinData.sessions.mobileApp} (${((asinData.sessions.mobileApp / asinData.sessions.total) * 100).toFixed(1)}%)`);
console.log(`Browser Sessions: ${asinData.sessions.browser} (${((asinData.sessions.browser / asinData.sessions.total) * 100).toFixed(1)}%)`);
console.log(`B2B Sessions: ${asinData.sessions.totalB2B} (${((asinData.sessions.totalB2B / asinData.sessions.total) * 100).toFixed(1)}%)`);
console.log('');

console.log('💰 BUSINESS INSIGHTS');
console.log('─'.repeat(70));
console.log(`• Strong Buy Box control (97.82% consumer, 100% B2B)`);
console.log(`• Good conversion rate: 28.57% (industry average ~2-3%)`);
console.log(`• B2B segment performing well: 66.67% conversion`);
console.log(`• Mobile traffic dominates: ${((asinData.sessions.mobileApp / asinData.sessions.total) * 100).toFixed(1)}% of sessions`);
console.log(`• Average order value: £${avgOrderValue.toFixed(2)} per unit`);
console.log('');

console.log('🎯 OPPORTUNITIES');
console.log('─'.repeat(70));
if (parseFloat(asinData.unitSessionPercentage.replace('%', '')) > 25) {
  console.log(`• Conversion rate is excellent (${asinData.unitSessionPercentage})`);
  console.log(`• Focus on increasing traffic rather than conversion`);
} else {
  console.log(`• Consider optimizing listing for better conversion`);
}

if (asinData.sessions.totalB2B < asinData.sessions.total * 0.1) {
  console.log(`• B2B segment is small but high-converting - consider B2B marketing`);
}

console.log(`• Current weekly run rate: ${totalUnits} units, £${totalRevenue.toFixed(2)} revenue`);
console.log(`  ↳ B2B makes up ${((asinData.unitsOrderedB2B / totalUnits) * 100).toFixed(1)}% of volume, ${((b2bRevenue / totalRevenue) * 100).toFixed(1)}% of revenue`);
console.log(`• Projected monthly: ~${(totalUnits * 4.3).toFixed(0)} units, ~£${(totalRevenue * 4.3).toFixed(2)}`);
console.log('');

console.log('✅ SUMMARY');
console.log('─'.repeat(70));
console.log('This ASIN is performing well with:');
console.log('• Strong Buy Box ownership');
console.log('• Above-average conversion rates');
console.log('• Decent weekly sales volume');
console.log('• Good B2B performance');
console.log('');
console.log('💡 Amazon Business Reports provided much richer data than API calls would!');
console.log('   This includes traffic sources, conversion rates, and Buy Box percentages');
console.log('   that would be difficult/impossible to get via SP-API.');
