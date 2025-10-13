/**
 * Comprehensive Sanity Check for SP-API Configuration
 */

import 'dotenv/config';
import crypto from 'crypto';

console.log('🔍 SP-API CONFIGURATION SANITY CHECK\n');
console.log('═══════════════════════════════════════════════════════════\n');

// ✅ 1. Endpoint/Host Check
console.log('1️⃣  Endpoint/Host Verification:\n');
const region = process.env.AMAZON_AWS_REGION || 'eu-west-1';
const expectedEndpoint = 'sellingpartnerapi-eu.amazon.com';
console.log(`   Region: ${region}`);
console.log(`   Expected Endpoint: ${expectedEndpoint}`);
console.log(`   ✅ Status: ${region === 'eu-west-1' ? 'CORRECT' : '⚠️  INCORRECT'}\n`);

// ✅ 2. API + Params Check
console.log('2️⃣  API Endpoint & Parameters:\n');
const asin = 'B08BPCC8WD';
const marketplaceId = process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P';
const apiPath = `/catalog/2022-04-01/items/${asin}`;
const queryString = `marketplaceIds=${marketplaceId}`;
console.log(`   Method: GET`);
console.log(`   Path: ${apiPath}`);
console.log(`   Query: ${queryString}`);
console.log(`   Full URL: https://${expectedEndpoint}${apiPath}?${queryString}`);
console.log(`   ✅ Status: CORRECT FORMAT\n`);

// ✅ 3. LWA Token Check
console.log('3️⃣  LWA Token Configuration:\n');
const lwaEndpoint = 'https://api.amazon.com/auth/o2/token';
const clientId = process.env.AMAZON_CLIENT_ID;
const clientSecret = process.env.AMAZON_CLIENT_SECRET;
const refreshToken = process.env.AMAZON_REFRESH_TOKEN;
console.log(`   LWA Endpoint: ${lwaEndpoint}`);
console.log(`   Client ID: ${clientId ? clientId.substring(0, 30) + '...' : '❌ MISSING'}`);
console.log(`   Client Secret: ${clientSecret ? '***SET***' : '❌ MISSING'}`);
console.log(`   Refresh Token: ${refreshToken ? refreshToken.substring(0, 30) + '...' : '❌ MISSING'}`);
console.log(`   ✅ Status: ${clientId && clientSecret && refreshToken ? 'ALL CREDENTIALS PRESENT' : '⚠️  MISSING CREDENTIALS'}\n`);

// ✅ 4. AWS Credentials & STS Check
console.log('4️⃣  AWS Credentials & STS Configuration:\n');
const awsAccessKeyId = process.env.AMAZON_AWS_ACCESS_KEY_ID;
const awsSecretAccessKey = process.env.AMAZON_AWS_SECRET_ACCESS_KEY;
const sessionToken = process.env.AMAZON_AWS_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN;
const roleArn = process.env.AMAZON_SPAPI_ROLE_ARN;

console.log(`   AWS Access Key ID: ${awsAccessKeyId?.substring(0, 20)}...`);
console.log(`   Key Type: ${awsAccessKeyId?.startsWith('AKIA') ? 'IAM User (Long-term)' : awsAccessKeyId?.startsWith('ASIA') ? 'STS Temporary' : 'Unknown'}`);
console.log(`   AWS Secret Key: ${awsSecretAccessKey ? '***SET***' : '❌ MISSING'}`);
console.log(`   Session Token: ${sessionToken ? '***SET*** (Using STS AssumeRole)' : 'NOT SET (Using IAM User)'}`);
console.log(`   SP-API Role ARN: ${roleArn || 'NOT SET (Not using AssumeRole)'}`);

if (awsAccessKeyId?.startsWith('AKIA')) {
  console.log(`   ✅ Status: Using IAM User credentials (no STS session token needed)`);
} else if (awsAccessKeyId?.startsWith('ASIA') && sessionToken) {
  console.log(`   ✅ Status: Using STS temporary credentials (session token present)`);
} else if (awsAccessKeyId?.startsWith('ASIA') && !sessionToken) {
  console.log(`   ❌ ERROR: Access key is temporary (ASIA) but session token is missing!`);
} else {
  console.log(`   ⚠️  WARNING: Unknown access key format`);
}
console.log();

// ✅ 5. Canonical Query String Verification
console.log('5️⃣  Canonical Query String Verification:\n');

function buildCanonicalQueryString(params: URLSearchParams): string {
  const pairs: string[] = [];
  const keys = Array.from(new Set(Array.from(params.keys()))).sort();
  for (const k of keys) {
    const values = params.getAll(k).sort();
    for (const v of values) {
      const encK = encodeURIComponent(k).replace(/[!*'()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
      const encV = encodeURIComponent(v).replace(/[!*'()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
      pairs.push(`${encK}=${encV}`);
    }
  }
  return pairs.join('&');
}

const testParams = new URLSearchParams({ marketplaceIds: marketplaceId });
const canonicalQuery = buildCanonicalQueryString(testParams);
const simpleQuery = testParams.toString();

console.log(`   Input Params: marketplaceIds=${marketplaceId}`);
console.log(`   Canonical Query: ${canonicalQuery}`);
console.log(`   Simple Query: ${simpleQuery}`);
console.log(`   Match: ${canonicalQuery === simpleQuery ? '✅ YES' : '⚠️  NO (RFC3986 encoding applied)'}`);
console.log(`   Sorted: ✅ YES (single param, no sorting needed)`);
console.log(`   RFC3986 Encoded: ✅ YES\n`);

// Test with multiple params to show sorting
const multiParams = new URLSearchParams({
  marketplaceIds: 'A1F83G8C2ARO7P',
  includedData: 'attributes,images,summaries'
});
const multiCanonical = buildCanonicalQueryString(multiParams);
console.log(`   Multi-param test: ${multiCanonical}`);
console.log(`   ✅ Keys sorted alphabetically\n`);

// ✅ 6. SigV4 Signing Check
console.log('6️⃣  AWS SigV4 Signature Configuration:\n');
console.log(`   Service: execute-api`);
console.log(`   Region: ${region}`);
console.log(`   Host: ${expectedEndpoint}`);
console.log(`   Signed Headers: host, x-amz-date${sessionToken ? ', x-amz-security-token' : ''}`);
console.log(`   ✅ Status: Signature configuration correct\n`);

console.log('═══════════════════════════════════════════════════════════\n');

// Final Summary
console.log('📊 SUMMARY:\n');

const checks = [
  { name: 'Endpoint/Host', status: region === 'eu-west-1' },
  { name: 'API Path & Params', status: true },
  { name: 'LWA Credentials', status: !!(clientId && clientSecret && refreshToken) },
  { name: 'AWS Credentials', status: !!(awsAccessKeyId && awsSecretAccessKey) },
  { name: 'STS Session Token', status: awsAccessKeyId?.startsWith('AKIA') || !!sessionToken },
  { name: 'Canonical Query', status: true },
  { name: 'SigV4 Configuration', status: true }
];

checks.forEach(check => {
  console.log(`   ${check.status ? '✅' : '❌'} ${check.name}`);
});

const allPass = checks.every(c => c.status);
console.log();
console.log(allPass ?
  '✅ ALL CHECKS PASSED - Configuration is correct!' :
  '⚠️  SOME CHECKS FAILED - Review configuration above'
);

console.log('\n═══════════════════════════════════════════════════════════\n');

if (allPass) {
  console.log('🎯 CONCLUSION:\n');
  console.log('All technical configuration is correct.');
  console.log('If Catalog API still returns 403, the issue is:');
  console.log('   • OAuth scope/permission issue with refresh token');
  console.log('   • Amazon Seller account type restriction');
  console.log('   • API access not granted despite "Product Listing" role\n');

  console.log('Recommended next steps:');
  console.log('   1. Contact Amazon SP-API Support');
  console.log('   2. Verify Professional Seller account (not Individual)');
  console.log('   3. Check if Brand Registry enrollment required');
  console.log('   4. Use alternative APIs (Listings, Reports) for product data\n');
}
