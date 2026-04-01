/**
 * Test FBM (Fulfilled by Merchant) Fees
 * 
 * FBM sellers should only pay:
 * - Referral Fee (category-based percentage)
 * - Variable Closing Fee (if applicable)
 * 
 * FBM sellers do NOT pay:
 * - FBA fulfillment fees
 */

import { SPAPIClient } from './src/lib/amazon/sp-api-client';
import { FeesService } from './src/lib/amazon/fees-service';
import * as dotenv from 'dotenv';

dotenv.config();

async function testFBMFees() {
  console.log('\n🧪 Testing FBM (Fulfilled by Merchant) Fees\n');
  console.log('='.repeat(60));

  const client = new SPAPIClient({
    clientId: process.env.AMAZON_CLIENT_ID!,
    clientSecret: process.env.AMAZON_CLIENT_SECRET!,
    refreshToken: process.env.AMAZON_REFRESH_TOKEN!,
    awsAccessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID!,
    awsSecretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY!,
    marketplaceId: 'A1F83G8C2ARO7P', // UK
    sellerId: process.env.AMAZON_SELLER_ID!,
    roleArn: process.env.AMAZON_ROLE_ARN!
  });

  const feesService = new FeesService(client);

  const testAsin = 'B08BPCC8WD'; // Test product
  const testPrice = 51.80;

  try {
    console.log(`\n📦 Product: ${testAsin}`);
    console.log(`💷 Price: £${testPrice.toFixed(2)}`);
    console.log(`🚚 Fulfillment: FBM (Fulfilled by Merchant)\n`);

    // Get FBM fees (isAmazonFulfilled = false)
    const fbmFees = await feesService.getFeeEstimate(testAsin, testPrice, false);

    console.log('✅ FBM Fee Breakdown:');
    console.log('-'.repeat(60));

    if (fbmFees.fbaFee > 0) {
      console.log(`⚠️  FBA Fee: £${fbmFees.fbaFee.toFixed(2)} (SHOULD BE £0.00 for FBM!)`);
    } else {
      console.log(`✅ FBA Fee: £${fbmFees.fbaFee.toFixed(2)} (Correct - no FBA fees)`);
    }

    console.log(`✅ Referral Fee: £${fbmFees.referralFee.toFixed(2)} (15% of £${testPrice})`);

    if (fbmFees.variableClosingFee > 0) {
      console.log(`   Closing Fee: £${fbmFees.variableClosingFee.toFixed(2)}`);
    }

    console.log('-'.repeat(60));
    console.log(`💰 Total Fees: £${fbmFees.totalFees.toFixed(2)}`);
    console.log(`💵 You Receive: £${fbmFees.estimatedProceeds.toFixed(2)}`);
    console.log(`📊 Fee %: ${((fbmFees.totalFees / testPrice) * 100).toFixed(1)}%`);

    // Compare with FBA
    console.log('\n\n📊 Comparison: FBA vs FBM');
    console.log('='.repeat(60));

    const fbaFees = await feesService.getFeeEstimate(testAsin, testPrice, true);

    console.log('\nFBA (Amazon Fulfillment):');
    console.log(`  FBA Fee: £${fbaFees.fbaFee.toFixed(2)}`);
    console.log(`  Referral Fee: £${fbaFees.referralFee.toFixed(2)}`);
    console.log(`  Total Fees: £${fbaFees.totalFees.toFixed(2)}`);
    console.log(`  You Receive: £${fbaFees.estimatedProceeds.toFixed(2)}`);

    console.log('\nFBM (Merchant Fulfillment):');
    console.log(`  FBA Fee: £${fbmFees.fbaFee.toFixed(2)} ✅`);
    console.log(`  Referral Fee: £${fbmFees.referralFee.toFixed(2)}`);
    console.log(`  Total Fees: £${fbmFees.totalFees.toFixed(2)}`);
    console.log(`  You Receive: £${fbmFees.estimatedProceeds.toFixed(2)}`);

    const fbmAdvantage = fbaFees.totalFees - fbmFees.totalFees;
    console.log(`\n💡 FBM saves you £${fbmAdvantage.toFixed(2)} in fees!`);
    console.log(`   (But you handle fulfillment yourself)`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test Complete!\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
    }
  }
}

testFBMFees();
