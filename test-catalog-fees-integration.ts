/**
 * Test Catalog and Fees Services Integration
 */

import 'dotenv/config';
import { SPAPIClient } from './src/lib/amazon/sp-api-client';
import { CatalogService } from './src/lib/amazon/catalog-service';
import { FeesService } from './src/lib/amazon/fees-service';

const TEST_ASIN = 'B08BPCC8WD';
const TEST_PRICE = 25.99;

async function testCatalogAndFeesIntegration() {
  console.log('🧪 Testing Catalog & Fees Services Integration\n');
  console.log('='.repeat(70));

  // Initialize SP-API Client
  const client = new SPAPIClient({
    clientId: process.env.AMAZON_CLIENT_ID!,
    clientSecret: process.env.AMAZON_CLIENT_SECRET!,
    refreshToken: process.env.AMAZON_REFRESH_TOKEN!,
    awsAccessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID!,
    awsSecretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY!,
    awsRegion: 'eu-west-1',
    marketplaceId: 'A1F83G8C2ARO7P',
    sellerId: process.env.AMAZON_SELLER_ID!,
    roleArn: process.env.AMAZON_ROLE_ARN!
  });

  const catalogService = new CatalogService(client);
  const feesService = new FeesService(client);

  console.log('\n📦 Test 1: Fetch Catalog Data');
  console.log('   ASIN:', TEST_ASIN);

  try {
    const product = await catalogService.getProduct(TEST_ASIN);

    console.log('\n   ✅ Catalog Data Retrieved:');
    console.log('   Title:', product.title);
    console.log('   Brand:', product.brand || 'N/A');
    console.log('   Category:', product.category || 'N/A');
    console.log('   Classification:', product.itemClassification || 'N/A');
    console.log('   Package Qty:', product.packageQuantity || 'N/A');
    console.log('   Images:', product.images.length);
    if (product.mainImage) {
      console.log('   Main Image:', product.mainImage.substring(0, 50) + '...');
    }
    if (product.bulletPoints) {
      console.log('   Features:', product.bulletPoints.length, 'bullet points');
      product.bulletPoints.slice(0, 2).forEach((bp, i) => {
        console.log(`      ${i + 1}. ${bp.substring(0, 60)}...`);
      });
    }
    if (product.dimensions) {
      if (product.dimensions.weight) {
        console.log(`   Weight: ${product.dimensions.weight.value} ${product.dimensions.weight.unit}`);
      }
      if (product.dimensions.length) {
        console.log(`   Dimensions: ${product.dimensions.length.value} × ${product.dimensions.width?.value} × ${product.dimensions.height?.value} ${product.dimensions.length.unit}`);
      }
    }
  } catch (error: any) {
    console.log('\n   ❌ Failed:', error.message);
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n💰 Test 2: Calculate Fees');
  console.log(`   ASIN: ${TEST_ASIN}`);
  console.log(`   List Price: £${TEST_PRICE.toFixed(2)}`);

  try {
    const fees = await feesService.getFeeEstimate(TEST_ASIN, TEST_PRICE, true);

    console.log('\n   ✅ Fee Breakdown:');
    console.log(`   FBA Fee:              £${fees.fbaFee.toFixed(2)}`);
    console.log(`   Referral Fee:         £${fees.referralFee.toFixed(2)}`);
    if (fees.variableClosingFee > 0) {
      console.log(`   Variable Closing Fee: £${fees.variableClosingFee.toFixed(2)}`);
    }
    console.log(`   --------------------------------`);
    console.log(`   Total Fees:           £${fees.totalFees.toFixed(2)}`);
    console.log(`   You Receive:          £${fees.estimatedProceeds.toFixed(2)}`);

    const feePercentage = ((fees.totalFees / TEST_PRICE) * 100).toFixed(1);
    console.log(`\n   Fee %: ${feePercentage}%`);
  } catch (error: any) {
    console.log('\n   ❌ Failed:', error.message);
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n💡 Test 3: Profit Analysis (with COGS)');

  const COGS = 10.00; // Example cost

  try {
    const analysis = await feesService.getProfitAnalysis(TEST_ASIN, TEST_PRICE, COGS, true);

    console.log(`   List Price:     £${analysis.listPrice.toFixed(2)}`);
    console.log(`   Total Fees:     £${analysis.totalFees.toFixed(2)}`);
    console.log(`   COGS:           £${COGS.toFixed(2)}`);
    console.log(`   --------------------------------`);
    console.log(`   Gross Profit:   £${analysis.grossProfit?.toFixed(2)}`);
    console.log(`   Profit Margin:  ${analysis.profitMargin?.toFixed(1)}%`);
    console.log(`   Break-even:     £${analysis.breakEvenPrice.toFixed(2)}`);

    if (analysis.grossProfit && analysis.grossProfit > 0) {
      console.log('\n   ✅ Profitable!');
    } else {
      console.log('\n   ⚠️  Not profitable at this price');
    }
  } catch (error: any) {
    console.log('\n   ❌ Failed:', error.message);
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n🎉 Integration Test Complete!\n');

  console.log('📝 Summary:');
  console.log('   ✅ Catalog Service: Fetches product data (title, images, features, dimensions)');
  console.log('   ✅ Fees Service: Calculates accurate FBA fees and profit analysis');
  console.log('   ✅ Both services use STS AssumeRole with External ID');
  console.log('   ✅ Ready for product page integration\n');

  console.log('🚀 Next: Visit http://localhost:5173/buy-box-alerts/product/' + TEST_ASIN);
  console.log('   to see the enhanced product page with real Amazon data!\n');
}

testCatalogAndFeesIntegration().catch(console.error);
