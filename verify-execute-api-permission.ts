/**
 * Generate IAM policy to check/add execute-api:Invoke permission
 */

console.log('🔐 IAM Policy Verification for Catalog API\n');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('📋 From your IAM screenshot, you have these policies:\n');
console.log('   1. AWSMarketplaceSellerFullAccess (AWS Managed)');
console.log('   2. AWSMarketplaceSellerOfferManagement (AWS Managed)');
console.log('   3. AWSMarketplaceSellerProductsFullAccess (AWS Managed)');
console.log('   4. AWSMarketplaceSellerProductsReadOnly (AWS Managed)');
console.log('   5. AWSPriceListServiceFullAccess (AWS Managed)');
console.log('   6. OperationsAPI (Custom)');
console.log('   7. SP-API-Additional-Permissions (Custom)');
console.log('   8. SP-API-Enhanced-Analytics-Access (Custom)');
console.log('   9. SQSBuyBoxNotifications (Custom)\n');

console.log('═══════════════════════════════════════════════════════════\n');

console.log('🔍 CRITICAL CHECK: execute-api:Invoke Permission\n');

console.log('For SP-API to work, IAM user needs:\n');

console.log('Policy Name: SP-API-Execute-Permission');
console.log('Policy JSON:');
console.log(`
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "execute-api:Invoke",
      "Resource": "arn:aws:execute-api:*:*:*"
    }
  ]
}
`);

console.log('═══════════════════════════════════════════════════════════\n');

console.log('📝 To verify this permission exists:\n');

console.log('1. Go to AWS IAM Console');
console.log('2. Select your user: amazon-spapi-user');
console.log('3. Click on each CUSTOM policy (not AWS managed ones):');
console.log('   • OperationsAPI');
console.log('   • SP-API-Additional-Permissions ← Most likely to have it');
console.log('   • SP-API-Enhanced-Analytics-Access');
console.log('   • SQSBuyBoxNotifications\n');

console.log('4. Look for "execute-api:Invoke" in the policy JSON\n');

console.log('If NOT found, create new policy with JSON above.\n');

console.log('═══════════════════════════════════════════════════════════\n');

console.log('⚠️  HOWEVER...\n');

console.log('Since Pricing, Fees, and Listings APIs all work,');
console.log('you likely ALREADY have execute-api:Invoke permission.');
console.log('Those APIs would fail too if this was missing.\n');

console.log('This points back to OAuth scope issue:\n');
console.log('   • Listings API works → Has OAuth permission');
console.log('   • Catalog API fails → Different OAuth permission needed\n');

console.log('═══════════════════════════════════════════════════════════\n');

console.log('🎯 RECOMMENDATION:\n');

console.log('The problem is almost certainly OAuth scope, not IAM.\n');

console.log('Evidence:');
console.log('   ✅ 4 other SP-APIs work (IAM is fine)');
console.log('   ✅ IAM User setup is correct');
console.log('   ✅ Using AKIA credentials (no session token needed)');
console.log('   ❌ Only Catalog API fails\n');

console.log('Next step:');
console.log('   📸 Screenshot the app authorization page');
console.log('   Show ALL available permission checkboxes');
console.log('   Look for "Catalog" vs "Listings" distinction\n');

console.log('Authorization URL:');
console.log('https://sellercentral.amazon.co.uk/apps/authorize/consent');
console.log('?application_id=amzn1.application-oa2-client.86a5e69c4a884eab8d37ff6f28fc6ff4\n');

console.log('═══════════════════════════════════════════════════════════\n');
