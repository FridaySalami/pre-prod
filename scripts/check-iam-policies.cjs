/**
 * Check required AWS IAM policies for Amazon SP-API enhanced features
 * This script helps identify what policies you need for sales analytics
 */

// AWS IAM Policies needed for different SP-API features
const requiredPolicies = {
  basic_spapi: [
    "AWSMarketplaceSellerFullAccess",
    "AWSMarketplaceSellerOfferManagement",
    "AWSMarketplaceSellerProductsFullAccess",
    "AWSMarketplaceSellerProductsReadOnly",
    "AWSPriceListServiceFullAccess"
  ],

  brand_analytics: [
    // These are the additional policies you likely need
    "AmazonAdvertisingAPI_FullAccess",
    "AmazonSellingPartnerAPI_Reports",
    "AmazonSellingPartnerAPI_Analytics",
    "AmazonSellingPartnerAPI_BrandAnalytics",
    "AmazonSellingPartnerAPI_BusinessReports"
  ],

  reports_api: [
    "AmazonSellingPartnerAPI_Reports",
    "AmazonSellingPartnerAPI_FinancialEvents",
    "AmazonSellingPartnerAPI_Orders"
  ],

  inventory_analytics: [
    "AmazonSellingPartnerAPI_Inventory",
    "AmazonSellingPartnerAPI_FBA"
  ]
};

console.log('🔍 AWS IAM POLICIES NEEDED FOR SP-API FEATURES');
console.log('═'.repeat(70));
console.log();

console.log('✅ BASIC SP-API (You currently have these):');
requiredPolicies.basic_spapi.forEach(policy => {
  console.log(`   • ${policy}`);
});

console.log();
console.log('🎯 ADDITIONAL POLICIES NEEDED FOR BRAND ANALYTICS:');
requiredPolicies.brand_analytics.forEach(policy => {
  console.log(`   • ${policy}`);
});

console.log();
console.log('📊 FOR REPORTS API:');
requiredPolicies.reports_api.forEach(policy => {
  console.log(`   • ${policy}`);
});

console.log();
console.log('📦 FOR INVENTORY ANALYTICS:');
requiredPolicies.inventory_analytics.forEach(policy => {
  console.log(`   • ${policy}`);
});

console.log();
console.log('💡 WHAT TO DO:');
console.log('1. In AWS IAM → Users → amazon-spapi-user → Permissions');
console.log('2. Click "Add permissions" → "Attach existing policies"');
console.log('3. Search for and add the missing policies above');
console.log('4. Some policies might not exist - create custom policies instead');
console.log();

console.log('🔧 CUSTOM POLICY EXAMPLE (if standard policies don\'t exist):');
console.log(JSON.stringify({
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "execute-api:Invoke",
        "execute-api:ManageConnections"
      ],
      "Resource": [
        "arn:aws:execute-api:*:*:*/*/POST/sales/*",
        "arn:aws:execute-api:*:*:*/*/GET/reports/*",
        "arn:aws:execute-api:*:*:*/*/POST/reports/*",
        "arn:aws:execute-api:*:*:*/*/GET/brandAnalytics/*",
        "arn:aws:execute-api:*:*:*/*/POST/brandAnalytics/*"
      ]
    }
  ]
}, null, 2));

console.log();
console.log('🚨 IMPORTANT NOTES:');
console.log('• Your refresh token has changed - this is good!');
console.log('• New token might have different permissions');
console.log('• Some SP-API endpoints require specific IAM policies');
console.log('• Brand Analytics needs both Seller Central AND AWS permissions');
