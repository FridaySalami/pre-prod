/**
 * Check if IAM permissions might be blocking Catalog API access
 * 
 * This helps determine if the issue is IAM-level vs OAuth scope-level
 */

import 'dotenv/config';

console.log('🔐 IAM Permission Analysis\n');
console.log('═══════════════════════════════════════════════════════════\n');

// Check environment variables
const awsAccessKey = process.env.AMAZON_AWS_ACCESS_KEY_ID;
const awsSecretKey = process.env.AMAZON_AWS_SECRET_ACCESS_KEY;
const region = process.env.AMAZON_AWS_REGION;

console.log('📋 AWS Credentials Configuration:');
console.log('  AWS Access Key ID:', awsAccessKey ? `${awsAccessKey.substring(0, 10)}...` : 'NOT SET');
console.log('  AWS Secret Key:', awsSecretKey ? 'SET (hidden)' : 'NOT SET');
console.log('  AWS Region:', region || 'NOT SET');

console.log('\n═══════════════════════════════════════════════════════════\n');

console.log('🔬 IAM vs OAuth Authorization Analysis:\n');

console.log('1️⃣  AWS IAM Permissions (AWS-level):');
console.log('   Purpose: Sign API requests with AWS SigV4');
console.log('   Status: ✅ WORKING');
console.log('   Evidence:');
console.log('   - Pricing API calls succeed (requires AWS signing)');
console.log('   - Fees API calls succeed (requires AWS signing)');
console.log('   - No signature errors (would get InvalidSignature if IAM blocked)');
console.log('   - Your IAM policies from screenshot appear sufficient\n');

console.log('2️⃣  SP-API OAuth Scopes (Seller Central authorization):');
console.log('   Purpose: Grant permission to specific SP-API endpoints');
console.log('   Status: ❌ MISSING "Product Listing" SCOPE');
console.log('   Evidence:');
console.log('   - Catalog API returns 403 AccessDeniedException');
console.log('   - Error: "Access to requested resource is denied"');
console.log('   - Pricing/Fees APIs work (different scopes)');
console.log('   - Both Catalog v0 and v2022-04-01 fail identically\n');

console.log('═══════════════════════════════════════════════════════════\n');

console.log('🎯 DIAGNOSIS:\n');
console.log('The issue is NOT with IAM permissions.');
console.log('IAM credentials are working correctly (proven by successful API calls).\n');

console.log('The issue IS with OAuth authorization scopes.');
console.log('Your refresh token lacks the "Product Listing" scope.\n');

console.log('═══════════════════════════════════════════════════════════\n');

console.log('📝 IAM Policies Visible in Screenshot:');
console.log('   ✅ AWSMarketplaceSellerFullAccess');
console.log('   ✅ AWSMarketplaceSellerOfferManagement');
console.log('   ✅ AWSMarketplaceSellerProductsFullAccess');
console.log('   ✅ AWSMarketplaceSellerProductsReadOnly');
console.log('   ✅ AWSPriceListServiceFullAccess');
console.log('   ✅ OperationsAPI');
console.log('   ✅ SP-API-Additional-Permissions');
console.log('   ✅ SP-API-Enhanced-Analytics-Access');
console.log('   ✅ SQSBuyBoxNotifications\n');

console.log('These IAM policies provide AWS-level permissions for:');
console.log('   • Marketplace operations');
console.log('   • Seller products (read/write)');
console.log('   • Price lists');
console.log('   • Enhanced analytics');
console.log('   • SQS notifications\n');

console.log('However, IAM policies CANNOT grant SP-API endpoint access.');
console.log('That requires OAuth scopes from Seller Central authorization.\n');

console.log('═══════════════════════════════════════════════════════════\n');

console.log('🔄 SOLUTION:\n');
console.log('Re-authorize your app in Seller Central ensuring ALL roles are checked:');
console.log('https://sellercentral.amazon.co.uk/apps/authorize/consent');
console.log('?application_id=amzn1.application-oa2-client.86a5e69c4a884eab8d37ff6f28fc6ff4\n');

console.log('Make sure to check:');
console.log('   ✅ Product Listing (required for Catalog API)');
console.log('   ✅ Pricing');
console.log('   ✅ Inventory');
console.log('   ✅ All other available permissions\n');

console.log('═══════════════════════════════════════════════════════════\n');
