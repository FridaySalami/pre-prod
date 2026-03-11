#!/usr/bin/env node

/**
 * Amazon SP-API Comprehensive Diagnostic Tool
 * 
 * This script provides a complete diagnostic of your Amazon SP-API integration,
 * including environment setup, OAuth, AWS credentials, and endpoint access.
 * 
 * Usage: node amazon-sp-api-diagnostics.js
 */

import crypto from 'crypto';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Color codes for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Load environment variables
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};

  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  });

  return env;
}

const env = loadEnvFile();

// Helper functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logResult(test, status, message, details = null) {
  const statusColors = {
    'PASS': 'green',
    'FAIL': 'red',
    'WARN': 'yellow',
    'INFO': 'blue'
  };

  const statusColor = statusColors[status] || 'reset';
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : status === 'WARN' ? '⚠' : 'ℹ';

  log(`${icon} ${test}: ${colors[statusColor]}${status}${colors.reset} - ${message}`);

  if (details) {
    if (typeof details === 'string') {
      log(`  ${details}`, 'cyan');
    } else {
      Object.entries(details).forEach(([key, value]) => {
        log(`  ${key}: ${value}`, 'cyan');
      });
    }
  }
}

function separator() {
  log('─'.repeat(80), 'blue');
}

// Test functions
async function testEnvironmentVariables() {
  log('\n🔧 Testing Environment Variables', 'bold');
  separator();

  const required = [
    'AMAZON_CLIENT_ID',
    'AMAZON_CLIENT_SECRET',
    'AMAZON_REFRESH_TOKEN',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY'
  ];

  const missing = required.filter(key => !env[key]);

  if (missing.length > 0) {
    logResult('Environment Check', 'FAIL', `Missing variables: ${missing.join(', ')}`);
    return false;
  }

  logResult('Environment Check', 'PASS', 'All required environment variables present');

  // Format validation
  const issues = [];
  if (env.AMAZON_CLIENT_ID && !env.AMAZON_CLIENT_ID.startsWith('amzn1.application-oa2-client.')) {
    issues.push('AMAZON_CLIENT_ID format appears invalid');
  }
  if (env.AMAZON_REFRESH_TOKEN && !env.AMAZON_REFRESH_TOKEN.startsWith('Atzr|')) {
    issues.push('AMAZON_REFRESH_TOKEN format appears invalid');
  }
  if (env.AWS_ACCESS_KEY_ID && env.AWS_ACCESS_KEY_ID.length !== 20) {
    issues.push('AWS_ACCESS_KEY_ID length appears invalid');
  }

  if (issues.length > 0) {
    logResult('Format Check', 'WARN', `Potential format issues: ${issues.join(', ')}`);
  } else {
    logResult('Format Check', 'PASS', 'All credential formats appear valid');
  }

  // Show masked credentials
  logResult('Credentials', 'INFO', 'Current configuration:', {
    'Amazon Client ID': env.AMAZON_CLIENT_ID?.substring(0, 20) + '...',
    'Has Refresh Token': !!env.AMAZON_REFRESH_TOKEN,
    'AWS Access Key': env.AWS_ACCESS_KEY_ID?.substring(0, 10) + '...',
    'Has AWS Secret': !!env.AWS_SECRET_ACCESS_KEY
  });

  return true;
}

async function testOAuthAndTokenExchange() {
  log('\n🔐 Testing OAuth and Token Exchange', 'bold');
  separator();

  if (!env.AMAZON_REFRESH_TOKEN) {
    logResult('OAuth Check', 'FAIL', 'No refresh token available');
    log('  💡 Complete OAuth flow by visiting: http://localhost:5173/api/amazon/oauth/authorize', 'yellow');
    return null;
  }

  try {
    const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: env.AMAZON_REFRESH_TOKEN,
        client_id: env.AMAZON_CLIENT_ID,
        client_secret: env.AMAZON_CLIENT_SECRET
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logResult('Token Exchange', 'FAIL', `HTTP ${tokenResponse.status}: ${tokenResponse.statusText}`);
      log(`  Error: ${errorText}`, 'red');
      return null;
    }

    const tokenData = await tokenResponse.json();

    logResult('Token Exchange', 'PASS', 'Successfully obtained access token');
    logResult('Token Details', 'INFO', 'Token information:', {
      'Token Type': tokenData.token_type,
      'Expires In': `${tokenData.expires_in} seconds`,
      'Scope': tokenData.scope
    });

    return tokenData.access_token;

  } catch (error) {
    logResult('Token Exchange', 'FAIL', `Request failed: ${error.message}`);
    return null;
  }
}

async function testAWSCredentials() {
  log('\n☁️  Testing AWS Credentials', 'bold');
  separator();

  try {
    const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const date = timestamp.substr(0, 8);
    const region = 'us-east-1';
    const service = 'sts';

    const host = `${service}.${region}.amazonaws.com`;
    const method = 'GET';
    const uri = '/';
    const querystring = 'Action=GetCallerIdentity&Version=2011-06-15';

    // Create AWS signature
    const canonical_request = `${method}\n${uri}\n${querystring}\nhost:${host}\nx-amz-date:${timestamp}\n\nhost;x-amz-date\n${crypto.createHash('sha256').update('').digest('hex')}`;

    const algorithm = 'AWS4-HMAC-SHA256';
    const credential_scope = `${date}/${region}/${service}/aws4_request`;
    const string_to_sign = `${algorithm}\n${timestamp}\n${credential_scope}\n${crypto.createHash('sha256').update(canonical_request).digest('hex')}`;

    const kDate = crypto.createHmac('sha256', 'AWS4' + env.AWS_SECRET_ACCESS_KEY).update(date).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();

    const signature = crypto.createHmac('sha256', kSigning).update(string_to_sign).digest('hex');

    const authorization = `${algorithm} Credential=${env.AWS_ACCESS_KEY_ID}/${credential_scope}, SignedHeaders=host;x-amz-date, Signature=${signature}`;

    const response = await fetch(`https://${host}/?${querystring}`, {
      method: 'GET',
      headers: {
        'Host': host,
        'X-Amz-Date': timestamp,
        'Authorization': authorization
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      logResult('AWS Credentials', 'FAIL', `HTTP ${response.status}: ${response.statusText}`);
      log(`  Error: ${errorText}`, 'red');
      return false;
    }

    const responseText = await response.text();
    const userIdMatch = responseText.match(/<UserId>([^<]+)<\/UserId>/);
    const arnMatch = responseText.match(/<Arn>([^<]+)<\/Arn>/);

    logResult('AWS Credentials', 'PASS', 'Credentials are valid');
    logResult('AWS Identity', 'INFO', 'Current AWS identity:', {
      'User ID': userIdMatch?.[1] || 'Unknown',
      'ARN': arnMatch?.[1] || 'Unknown'
    });

    return true;

  } catch (error) {
    logResult('AWS Credentials', 'FAIL', `Request failed: ${error.message}`);
    return false;
  }
}

async function testSpApiEndpoint(name, endpoint, accessToken) {
  try {
    const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const date = timestamp.substr(0, 8);
    const region = 'eu-west-1';
    const service = 'execute-api';

    const host = `sellingpartnerapi-eu.amazon.com`;
    const method = 'GET';
    const uri = endpoint;
    const querystring = '';

    // Create AWS signature for SP-API
    const canonical_request = `${method}\n${uri}\n${querystring}\nhost:${host}\nx-amz-access-token:${accessToken}\nx-amz-date:${timestamp}\n\nhost;x-amz-access-token;x-amz-date\n${crypto.createHash('sha256').update('').digest('hex')}`;

    const algorithm = 'AWS4-HMAC-SHA256';
    const credential_scope = `${date}/${region}/${service}/aws4_request`;
    const string_to_sign = `${algorithm}\n${timestamp}\n${credential_scope}\n${crypto.createHash('sha256').update(canonical_request).digest('hex')}`;

    const kDate = crypto.createHmac('sha256', 'AWS4' + env.AWS_SECRET_ACCESS_KEY).update(date).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();

    const signature = crypto.createHmac('sha256', kSigning).update(string_to_sign).digest('hex');

    const authorization = `${algorithm} Credential=${env.AWS_ACCESS_KEY_ID}/${credential_scope}, SignedHeaders=host;x-amz-access-token;x-amz-date, Signature=${signature}`;

    const response = await fetch(`https://${host}${endpoint}`, {
      method: 'GET',
      headers: {
        'Host': host,
        'Authorization': authorization,
        'x-amz-access-token': accessToken,
        'x-amz-date': timestamp
      }
    });

    const responseText = await response.text();

    if (response.status === 403) {
      logResult(`${name} API`, 'FAIL', `Access denied (403) - Permission issue`);
      log(`  💡 Check Amazon Developer Console permissions and AWS IAM policy`, 'yellow');
      return false;
    }

    if (response.status === 404) {
      logResult(`${name} API`, 'WARN', `No data found (404) - Endpoint accessible but no data`);
      return true;
    }

    if (!response.ok) {
      logResult(`${name} API`, 'FAIL', `HTTP ${response.status}: ${response.statusText}`);
      log(`  Response: ${responseText.substring(0, 200)}`, 'red');
      return false;
    }

    logResult(`${name} API`, 'PASS', `Successfully accessed - ${response.status}`);

    // Try to parse and show some data
    try {
      const data = JSON.parse(responseText);
      if (data.payload) {
        logResult(`${name} Data`, 'INFO', `Response contains ${Object.keys(data.payload).length} payload keys`);
      }
    } catch (e) {
      logResult(`${name} Response`, 'INFO', `Received ${responseText.length} characters of data`);
    }

    return true;

  } catch (error) {
    logResult(`${name} API`, 'FAIL', `Request failed: ${error.message}`);
    return false;
  }
}

async function testEndpoints(accessToken) {
  log('\n🌐 Testing SP-API Endpoints', 'bold');
  separator();

  if (!accessToken) {
    logResult('Endpoint Tests', 'FAIL', 'No access token available - skipping endpoint tests');
    return;
  }

  // Test different endpoints
  const endpoints = [
    {
      name: 'Orders',
      endpoint: '/orders/v0/orders?MarketplaceIds=A1F83G8C2ARO7P&CreatedAfter=2024-01-01T00:00:00Z'
    },
    {
      name: 'Pricing',
      endpoint: '/products/pricing/v0/price?MarketplaceId=A1F83G8C2ARO7P&Skus=TEST-SKU-123'
    },
    {
      name: 'Inventory',
      endpoint: '/fba/inventory/v1/summaries?granularityType=Marketplace&granularityId=A1F83G8C2ARO7P&marketplaceIds=A1F83G8C2ARO7P'
    },
    {
      name: 'Listings',
      endpoint: '/listings/2021-08-01/items?marketplaceIds=A1F83G8C2ARO7P&pageSize=10'
    }
  ];

  const results = [];

  for (const { name, endpoint } of endpoints) {
    const success = await testSpApiEndpoint(name, endpoint, accessToken);
    results.push({ name, success });
  }

  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  logResult('Endpoint Summary', 'INFO', `${successCount}/${totalCount} endpoints accessible`);

  return results;
}

function generateSummaryReport(envOk, accessToken, awsOk, endpointResults) {
  log('\n📊 Summary Report', 'bold');
  separator();

  const issues = [];
  const recommendations = [];

  if (!envOk) {
    issues.push('Environment configuration');
    recommendations.push('Fix missing environment variables in .env file');
  }

  if (!accessToken) {
    issues.push('OAuth authentication');
    recommendations.push('Complete OAuth flow or check Amazon client credentials');
  }

  if (!awsOk) {
    issues.push('AWS credentials');
    recommendations.push('Verify AWS access key, secret key, and IAM user');
  }

  if (endpointResults) {
    const failedEndpoints = endpointResults.filter(r => !r.success);
    if (failedEndpoints.length > 0) {
      issues.push(`${failedEndpoints.length} endpoint access failures`);
      recommendations.push('Update Amazon Developer Console permissions');
      recommendations.push('Update AWS IAM policy for SP-API access');
      recommendations.push('Wait 5-10 minutes for AWS policy changes to propagate');
    }
  }

  if (issues.length === 0) {
    logResult('Overall Status', 'PASS', 'All systems operational! 🎉');
  } else {
    logResult('Overall Status', 'FAIL', `${issues.length} issue(s) detected`);
    log('\n🔍 Issues Found:', 'red');
    issues.forEach(issue => log(`  • ${issue}`, 'red'));
  }

  if (recommendations.length > 0) {
    log('\n💡 Recommendations:', 'yellow');
    recommendations.forEach(rec => log(`  • ${rec}`, 'yellow'));
  }

  log('\n📋 Next Steps:', 'blue');
  log('  1. Fix any critical issues identified above', 'blue');
  log('  2. Wait for AWS IAM policy changes to propagate (5-10 minutes)', 'blue');
  log('  3. Re-run this diagnostic script to verify fixes', 'blue');
  log('  4. Check Amazon Developer Console for any pending approval requests', 'blue');
  log('  5. Test with real SKUs/ASINs from your inventory', 'blue');

  separator();
  log(`Diagnostic completed at ${new Date().toLocaleString()}`, 'cyan');
}

// Main execution
async function main() {
  log('🔍 Amazon SP-API Comprehensive Diagnostic Tool', 'bold');
  log('═'.repeat(50), 'magenta');

  try {
    const envOk = await testEnvironmentVariables();

    if (!envOk) {
      log('\n❌ Critical environment issues detected. Please fix before proceeding.', 'red');
      process.exit(1);
    }

    const accessToken = await testOAuthAndTokenExchange();
    const awsOk = await testAWSCredentials();
    const endpointResults = await testEndpoints(accessToken);

    generateSummaryReport(envOk, accessToken, awsOk, endpointResults);

  } catch (error) {
    log(`\n❌ Diagnostic failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run the diagnostic
main().catch(console.error);
