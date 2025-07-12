#!/usr/bin/env node

/**
 * COMPREHENSIVE AMAZON SP-API TROUBLESHOOTING TOOL
 * =================================================
 * 
 * This script performs a complete diagnostic of your Amazon SP-API setup:
 * 1. Environment variables validation
 * 2. OAuth token refresh testing
 * 3. AWS credentials validation
 * 4. AWS signature generation testing
 * 5. SP-API endpoint permission testing
 * 6. Error analysis and recommendations
 * 
 * Perfect for sharing with team members or support.
 * 
 * Usage: node sp-api-comprehensive-test.js
 */

import https from 'https';
import crypto from 'crypto';
import { config } from 'dotenv';

config();

// Configuration
const CONFIG = {
  CLIENT_ID: process.env.AMAZON_CLIENT_ID,
  CLIENT_SECRET: process.env.AMAZON_CLIENT_SECRET,
  REFRESH_TOKEN: process.env.AMAZON_REFRESH_TOKEN,
  AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  REGION: process.env.AMAZON_REGION || 'eu-west-1',
  MARKETPLACE_ID: process.env.AMAZON_MARKETPLACE_ID,
  SELLER_ID: process.env.AMAZON_SELLER_ID
};

// Test results storage
const RESULTS = {
  environment: {},
  oauth: {},
  aws: {},
  endpoints: {},
  summary: {}
};

console.log('🔍 AMAZON SP-API COMPREHENSIVE DIAGNOSTICS');
console.log('==========================================');
console.log(`📅 Test Date: ${new Date().toISOString()}`);
console.log(`🌍 Region: ${CONFIG.REGION}`);
console.log(`🏪 Marketplace: ${CONFIG.MARKETPLACE_ID}`);
console.log('');

// =============================================================================
// STEP 1: ENVIRONMENT VALIDATION
// =============================================================================
function validateEnvironment() {
  console.log('📋 STEP 1: ENVIRONMENT VALIDATION');
  console.log('─'.repeat(50));

  const requiredVars = [
    { name: 'AMAZON_CLIENT_ID', value: CONFIG.CLIENT_ID, required: true },
    { name: 'AMAZON_CLIENT_SECRET', value: CONFIG.CLIENT_SECRET, required: true },
    { name: 'AMAZON_REFRESH_TOKEN', value: CONFIG.REFRESH_TOKEN, required: true },
    { name: 'AWS_ACCESS_KEY_ID', value: CONFIG.AWS_ACCESS_KEY, required: true },
    { name: 'AWS_SECRET_ACCESS_KEY', value: CONFIG.AWS_SECRET_KEY, required: true },
    { name: 'AMAZON_REGION', value: CONFIG.REGION, required: false },
    { name: 'AMAZON_MARKETPLACE_ID', value: CONFIG.MARKETPLACE_ID, required: true },
    { name: 'AMAZON_SELLER_ID', value: CONFIG.SELLER_ID, required: false }
  ];

  let missingRequired = 0;

  requiredVars.forEach(variable => {
    const status = variable.value ? '✅' : (variable.required ? '❌' : '⚠️');
    const displayValue = variable.value ?
      (variable.value.substring(0, 10) + '...') :
      'NOT SET';

    console.log(`${status} ${variable.name}: ${displayValue}`);

    if (variable.required && !variable.value) {
      missingRequired++;
    }

    RESULTS.environment[variable.name] = {
      present: !!variable.value,
      required: variable.required,
      status: variable.value ? 'OK' : (variable.required ? 'MISSING' : 'OPTIONAL')
    };
  });

  console.log('');
  if (missingRequired > 0) {
    console.log(`❌ ${missingRequired} required environment variables missing!`);
    RESULTS.environment.status = 'FAILED';
    return false;
  } else {
    console.log('✅ All required environment variables present');
    RESULTS.environment.status = 'PASSED';
    return true;
  }
}

// =============================================================================
// STEP 2: OAUTH TOKEN TESTING
// =============================================================================
async function testOAuthToken() {
  console.log('📋 STEP 2: OAUTH TOKEN VALIDATION');
  console.log('─'.repeat(50));

  try {
    console.log('🔐 Testing refresh token...');

    const postData = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: CONFIG.REFRESH_TOKEN,
      client_id: CONFIG.CLIENT_ID,
      client_secret: CONFIG.CLIENT_SECRET
    }).toString();

    const tokenData = await makeHttpsRequest({
      hostname: 'api.amazon.com',
      path: '/auth/o2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, postData);

    if (tokenData.statusCode === 200) {
      const result = JSON.parse(tokenData.data);
      console.log('✅ OAuth token refresh successful');
      console.log(`   Token type: ${result.token_type}`);
      console.log(`   Expires in: ${result.expires_in} seconds`);
      console.log(`   Scope: ${result.scope || 'Not specified'}`);

      RESULTS.oauth = {
        status: 'PASSED',
        tokenType: result.token_type,
        expiresIn: result.expires_in,
        scope: result.scope || 'Not specified',
        accessToken: result.access_token
      };

      return result.access_token;
    } else {
      const error = JSON.parse(tokenData.data);
      console.log('❌ OAuth token refresh failed');
      console.log(`   Status: ${tokenData.statusCode}`);
      console.log(`   Error: ${error.error}`);
      console.log(`   Description: ${error.error_description}`);

      RESULTS.oauth = {
        status: 'FAILED',
        error: error.error,
        description: error.error_description,
        statusCode: tokenData.statusCode
      };

      return null;
    }
  } catch (error) {
    console.log('❌ OAuth test failed with exception');
    console.log(`   Error: ${error.message}`);

    RESULTS.oauth = {
      status: 'ERROR',
      error: error.message
    };

    return null;
  }
}

// =============================================================================
// STEP 3: AWS CREDENTIALS VALIDATION
// =============================================================================
function validateAWSCredentials() {
  console.log('📋 STEP 3: AWS CREDENTIALS VALIDATION');
  console.log('─'.repeat(50));

  // Validate format
  const accessKeyPattern = /^AKIA[0-9A-Z]{16}$/;
  const secretKeyPattern = /^[A-Za-z0-9/+=]{40}$/;

  const accessKeyValid = accessKeyPattern.test(CONFIG.AWS_ACCESS_KEY);
  const secretKeyValid = secretKeyPattern.test(CONFIG.AWS_SECRET_KEY);

  console.log(`${accessKeyValid ? '✅' : '❌'} Access Key format: ${CONFIG.AWS_ACCESS_KEY}`);
  console.log(`${secretKeyValid ? '✅' : '❌'} Secret Key format: ${secretKeyValid ? 'Valid' : 'Invalid'}`);
  console.log(`✅ Region: ${CONFIG.REGION}`);

  // Test signature generation
  try {
    const testSignature = createAWSSignature(
      'test-token',
      'sellingpartnerapi-eu.amazon.com',
      '/test/path',
      'test=query'
    );

    console.log('✅ AWS signature generation successful');
    console.log(`   Authorization header created: ${testSignature.headers.Authorization.substring(0, 50)}...`);

    RESULTS.aws = {
      status: 'PASSED',
      accessKeyFormat: accessKeyValid,
      secretKeyFormat: secretKeyValid,
      signatureGeneration: true
    };

    return true;
  } catch (error) {
    console.log('❌ AWS signature generation failed');
    console.log(`   Error: ${error.message}`);

    RESULTS.aws = {
      status: 'FAILED',
      accessKeyFormat: accessKeyValid,
      secretKeyFormat: secretKeyValid,
      signatureGeneration: false,
      error: error.message
    };

    return false;
  }
}

// =============================================================================
// STEP 4: SP-API ENDPOINT TESTING
// =============================================================================
async function testSPAPIEndpoints(accessToken) {
  console.log('📋 STEP 4: SP-API ENDPOINT TESTING');
  console.log('─'.repeat(50));

  if (!accessToken) {
    console.log('❌ Cannot test endpoints - no access token available');
    RESULTS.endpoints.status = 'SKIPPED';
    return;
  }

  const endpoints = [
    {
      name: 'Orders API',
      category: 'Basic',
      path: '/orders/v0/orders',
      query: `MarketplaceIds=${CONFIG.MARKETPLACE_ID}&CreatedAfter=2024-01-01T00:00:00Z`,
      expectedPermission: 'Built-in (basic SP-API access)',
      importance: 'CRITICAL'
    },
    {
      name: 'Product Pricing',
      category: 'Pricing',
      path: '/products/pricing/v0/price',
      query: `MarketplaceId=${CONFIG.MARKETPLACE_ID}&Skus=TEST-SKU`,
      expectedPermission: 'Pricing role in Amazon Developer Console',
      importance: 'HIGH'
    },
    {
      name: 'Competitive Pricing',
      category: 'Pricing',
      path: '/products/pricing/v0/competitivePrice',
      query: `MarketplaceId=${CONFIG.MARKETPLACE_ID}&Skus=TEST-SKU`,
      expectedPermission: 'Pricing role in Amazon Developer Console',
      importance: 'MEDIUM'
    },
    {
      name: 'FBA Inventory Summary',
      category: 'Inventory',
      path: '/fba/inventory/v1/summaries',
      query: `details=true&granularityType=Marketplace&granularityId=${CONFIG.MARKETPLACE_ID}`,
      expectedPermission: 'Inventory and Order Tracking + AWS IAM permissions',
      importance: 'HIGH'
    },
    {
      name: 'Listings Items',
      category: 'Listings',
      path: '/listings/2021-08-01/items',
      query: `marketplaceIds=${CONFIG.MARKETPLACE_ID}`,
      expectedPermission: 'Product Listing + AWS IAM permissions',
      importance: 'HIGH'
    },
    {
      name: 'Reports API',
      category: 'Reports',
      path: '/reports/2021-06-30/reports',
      query: '',
      expectedPermission: 'Reports access + AWS IAM permissions',
      importance: 'MEDIUM'
    },
    {
      name: 'Marketplace Participations',
      category: 'Account',
      path: '/sellers/v1/marketplaceParticipations',
      query: '',
      expectedPermission: 'Basic account access',
      importance: 'LOW'
    }
  ];

  const endpointResults = {};

  for (const endpoint of endpoints) {
    console.log(`\n🧪 Testing ${endpoint.name}...`);

    try {
      const result = await testSingleEndpoint(
        accessToken,
        endpoint.path,
        endpoint.query,
        endpoint.name
      );

      let status, message;

      if (result.statusCode === 200) {
        status = '✅ SUCCESS';
        message = 'Full access - endpoint working';
      } else if (result.statusCode === 403) {
        status = '❌ ACCESS DENIED';
        message = `Missing permission: ${endpoint.expectedPermission}`;
      } else if (result.statusCode === 404) {
        status = '⚠️ NOT FOUND';
        message = 'Permission exists but needs valid parameters';
      } else if (result.statusCode === 400) {
        status = '⚠️ BAD REQUEST';
        message = 'Permission exists but request format issues';
      } else {
        status = `⚠️ STATUS ${result.statusCode}`;
        message = 'Unexpected response';
      }

      console.log(`   ${status}: ${message}`);

      if (result.statusCode === 403) {
        console.log(`   💡 Required: ${endpoint.expectedPermission}`);
      }

      if (result.statusCode === 200 && result.data) {
        try {
          const parsedData = JSON.parse(result.data);
          if (parsedData.payload) {
            if (parsedData.payload.Orders) {
              console.log(`   📊 Found: ${parsedData.payload.Orders.length} orders`);
            } else if (parsedData.payload.length !== undefined) {
              console.log(`   📊 Found: ${parsedData.payload.length} items`);
            }
          }
        } catch (e) {
          // Data parsing failed, but that's ok for this diagnostic
        }
      }

      endpointResults[endpoint.name] = {
        status: result.statusCode,
        category: endpoint.category,
        importance: endpoint.importance,
        hasAccess: result.statusCode === 200,
        needsPermission: result.statusCode === 403,
        working: [200, 400, 404].includes(result.statusCode),
        expectedPermission: endpoint.expectedPermission
      };

    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      endpointResults[endpoint.name] = {
        status: 'ERROR',
        category: endpoint.category,
        importance: endpoint.importance,
        hasAccess: false,
        needsPermission: false,
        working: false,
        error: error.message
      };
    }

    // Rate limiting delay
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  RESULTS.endpoints = {
    status: 'COMPLETED',
    results: endpointResults,
    summary: generateEndpointSummary(endpointResults)
  };
}

// =============================================================================
// STEP 5: COMPREHENSIVE ANALYSIS
// =============================================================================
function generateDiagnosticReport() {
  console.log('\n📊 COMPREHENSIVE DIAGNOSTIC REPORT');
  console.log('═'.repeat(60));

  // Overall Status
  const environmentOK = RESULTS.environment.status === 'PASSED';
  const oauthOK = RESULTS.oauth.status === 'PASSED';
  const awsOK = RESULTS.aws.status === 'PASSED';
  const hasEndpointData = RESULTS.endpoints.status === 'COMPLETED';

  console.log('\n🎯 OVERALL STATUS:');
  console.log(`${environmentOK ? '✅' : '❌'} Environment Variables`);
  console.log(`${oauthOK ? '✅' : '❌'} OAuth Authentication`);
  console.log(`${awsOK ? '✅' : '❌'} AWS Credentials`);
  console.log(`${hasEndpointData ? '✅' : '❌'} SP-API Endpoint Testing`);

  // Detailed Analysis
  if (hasEndpointData) {
    console.log('\n📈 ENDPOINT ACCESS SUMMARY:');
    const summary = RESULTS.endpoints.summary;
    console.log(`✅ Working endpoints: ${summary.working}`);
    console.log(`❌ Permission denied: ${summary.permissionDenied}`);
    console.log(`⚠️ Needs parameters: ${summary.needsParameters}`);
    console.log(`💥 Errors: ${summary.errors}`);
  }

  // Critical Issues
  console.log('\n🚨 CRITICAL ISSUES:');
  const criticalIssues = [];

  if (!environmentOK) criticalIssues.push('Missing required environment variables');
  if (!oauthOK) criticalIssues.push('OAuth authentication failing');
  if (!awsOK) criticalIssues.push('AWS credentials invalid');

  if (hasEndpointData) {
    const orderAccess = RESULTS.endpoints.results['Orders API']?.hasAccess;
    if (!orderAccess) criticalIssues.push('No access to basic Orders API');
  }

  if (criticalIssues.length === 0) {
    console.log('✅ No critical issues found!');
  } else {
    criticalIssues.forEach((issue, index) => {
      console.log(`${index + 1}. ❌ ${issue}`);
    });
  }

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');

  if (!environmentOK) {
    console.log('1. 🔧 Fix missing environment variables in your .env file');
  }

  if (!oauthOK) {
    console.log('2. 🔑 Re-run OAuth authorization flow to get new refresh token');
    console.log('   Visit: http://localhost:3000/api/amazon/oauth/authorize');
  }

  if (!awsOK) {
    console.log('3. ☁️ Generate new AWS access keys in IAM console');
    console.log('   Update AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env');
  }

  if (hasEndpointData) {
    const permissionIssues = Object.entries(RESULTS.endpoints.results)
      .filter(([_, result]) => result.needsPermission)
      .map(([name, result]) => ({ name, permission: result.expectedPermission }));

    if (permissionIssues.length > 0) {
      console.log('4. 🔐 Add missing permissions:');
      permissionIssues.forEach(issue => {
        console.log(`   - ${issue.name}: ${issue.permission}`);
      });
    }
  }

  // Next Steps
  console.log('\n🎯 NEXT STEPS:');
  console.log('1. Fix any critical issues listed above');
  console.log('2. Add missing permissions in Amazon Developer Console');
  console.log('3. Add corresponding AWS IAM permissions');
  console.log('4. Re-run this diagnostic after changes');
  console.log('5. Once basic access works, test with real SKUs for pricing');

  // Export Results
  console.log('\n📤 SHARING THIS REPORT:');
  console.log('1. Copy this entire output to share with team members');
  console.log('2. Raw data available in RESULTS object (see below)');
  console.log('3. Run with: node sp-api-comprehensive-test.js');

  console.log('\n📋 RAW TEST DATA:');
  console.log('─'.repeat(30));
  console.log(JSON.stringify(RESULTS, null, 2));
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

// HTTP request wrapper
function makeHttpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

// AWS Signature v4 generation
function createAWSSignature(accessToken, endpoint, path, query = '') {
  const service = 'execute-api';
  const method = 'GET';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substr(0, 8);

  const canonicalHeaders = [
    `host:${endpoint}`,
    `user-agent:SP-API-Diagnostic/1.0`,
    `x-amz-access-token:${accessToken}`,
    `x-amz-date:${amzDate}`
  ].join('\n') + '\n';

  const signedHeaders = 'host;user-agent;x-amz-access-token;x-amz-date';

  const canonicalRequest = [
    method,
    path,
    query,
    canonicalHeaders,
    signedHeaders,
    crypto.createHash('sha256').update('').digest('hex')
  ].join('\n');

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${CONFIG.REGION}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  const kDate = crypto.createHmac('sha256', `AWS4${CONFIG.AWS_SECRET_KEY}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(CONFIG.REGION).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorization = `${algorithm} Credential=${CONFIG.AWS_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    headers: {
      'Authorization': authorization,
      'User-Agent': 'SP-API-Diagnostic/1.0',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate
    },
    fullPath: query ? `${path}?${query}` : path
  };
}

// Test single endpoint
async function testSingleEndpoint(accessToken, path, query, name) {
  const endpoint = 'sellingpartnerapi-eu.amazon.com';
  const { headers, fullPath } = createAWSSignature(accessToken, endpoint, path, query);

  return await makeHttpsRequest({
    hostname: endpoint,
    path: fullPath,
    method: 'GET',
    headers: headers
  });
}

// Generate endpoint summary
function generateEndpointSummary(endpointResults) {
  const summary = {
    total: 0,
    working: 0,
    permissionDenied: 0,
    needsParameters: 0,
    errors: 0
  };

  Object.values(endpointResults).forEach(result => {
    summary.total++;

    if (result.hasAccess) {
      summary.working++;
    } else if (result.needsPermission) {
      summary.permissionDenied++;
    } else if (result.status === 404) {
      summary.needsParameters++;
    } else {
      summary.errors++;
    }
  });

  return summary;
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================
async function runComprehensiveDiagnostic() {
  try {
    console.log('🚀 Starting comprehensive SP-API diagnostic...\n');

    // Step 1: Environment validation
    const envOK = validateEnvironment();
    console.log('');

    if (!envOK) {
      console.log('❌ Cannot continue - missing required environment variables');
      generateDiagnosticReport();
      return;
    }

    // Step 2: OAuth testing
    const accessToken = await testOAuthToken();
    console.log('');

    // Step 3: AWS validation
    const awsOK = validateAWSCredentials();
    console.log('');

    // Step 4: Endpoint testing
    if (accessToken && awsOK) {
      await testSPAPIEndpoints(accessToken);
    } else {
      console.log('❌ Skipping endpoint tests - OAuth or AWS issues');
      RESULTS.endpoints.status = 'SKIPPED';
    }

    // Step 5: Final report
    generateDiagnosticReport();

  } catch (error) {
    console.error('💥 Diagnostic failed with unexpected error:');
    console.error(error);
  }
}

// Run the diagnostic
runComprehensiveDiagnostic();
