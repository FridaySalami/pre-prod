/**
 * Test Catalog API with External ID in AssumeRole
 * 
 * Amazon SP-API documentation suggests using External ID (Seller ID)
 * for additional security when assuming roles.
 */

import 'dotenv/config';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import crypto from 'crypto';

const ASIN = 'B08BPCC8WD';
const MARKETPLACE_ID = 'A1F83G8C2ARO7P'; // UK
const REGION = 'eu-west-1';
const HOST = 'sellingpartnerapi-eu.amazon.com';
const SELLER_ID = process.env.AMAZON_SELLER_ID; // External ID
const ROLE_ARN = process.env.AMAZON_ROLE_ARN;

interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}

async function getAccessToken(): Promise<string> {
  const response = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.AMAZON_REFRESH_TOKEN!,
      client_id: process.env.AMAZON_CLIENT_ID!,
      client_secret: process.env.AMAZON_CLIENT_SECRET!
    })
  });

  const data = await response.json();
  return data.access_token;
}

async function assumeRoleWithExternalId(): Promise<Credentials> {
  const sts = new STSClient({
    region: REGION,
    credentials: {
      accessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY!
    }
  });

  console.log('🔐 Assuming role WITH External ID (Seller ID):', SELLER_ID);

  const command = new AssumeRoleCommand({
    RoleArn: ROLE_ARN!,
    RoleSessionName: `spapi-catalog-${Date.now()}`,
    DurationSeconds: 3600,
    ExternalId: SELLER_ID // Include Seller ID as External ID
  });

  const response = await sts.send(command);

  if (!response.Credentials) {
    throw new Error('No credentials returned from AssumeRole');
  }

  console.log('✅ AssumeRole successful with External ID');
  console.log('   Temp Access Key:', response.Credentials.AccessKeyId?.substring(0, 20) + '...');
  console.log('   Session Token:', response.Credentials.SessionToken ? 'Present ✓' : 'Missing ✗');

  return {
    accessKeyId: response.Credentials.AccessKeyId!,
    secretAccessKey: response.Credentials.SecretAccessKey!,
    sessionToken: response.Credentials.SessionToken!
  };
}

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

async function signRequest(
  method: string,
  path: string,
  queryParams: URLSearchParams,
  headers: Record<string, string>,
  creds: Credentials
): Promise<Record<string, string>> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  // Add session token to headers BEFORE canonicalization
  headers['x-amz-security-token'] = creds.sessionToken;

  const canonicalUri = path;
  const canonicalQueryString = buildCanonicalQueryString(queryParams);

  // Canonical headers - MUST include session token
  const canonicalHeadersLines = [
    `host:${HOST}`,
    `x-amz-date:${amzDate}`,
    `x-amz-security-token:${creds.sessionToken}`
  ];

  const canonicalHeaders = canonicalHeadersLines.join('\n') + '\n';
  const signedHeaders = 'host;x-amz-date;x-amz-security-token';
  const payloadHash = crypto.createHash('sha256').update('').digest('hex');

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${REGION}/execute-api/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  const kDate = crypto.createHmac('sha256', `AWS4${creds.secretAccessKey}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(REGION).digest();
  const kService = crypto.createHmac('sha256', kRegion).update('execute-api').digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorizationHeader = `${algorithm} Credential=${creds.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...headers,
    'host': HOST,
    'x-amz-date': amzDate,
    'Authorization': authorizationHeader
  };
}

async function testCatalogApi() {
  console.log('🧪 Testing Catalog API with External ID in AssumeRole\n');
  console.log('='.repeat(70));

  // Step 1: Get LWA token
  console.log('\n📝 Step 1: Getting LWA access token...');
  const accessToken = await getAccessToken();
  console.log('✅ LWA token obtained\n');

  // Step 2: AssumeRole WITH External ID (Seller ID)
  console.log('📝 Step 2: AssumeRole with External ID...');
  const creds = await assumeRoleWithExternalId();
  console.log('');

  // Step 3: Call Catalog API with session token
  console.log('📝 Step 3: Calling Catalog API...');
  const path = `/catalog/2022-04-01/items/${ASIN}`;
  const queryParams = new URLSearchParams({
    marketplaceIds: MARKETPLACE_ID
  });

  const headers: Record<string, string> = {
    'x-amz-access-token': accessToken,
    'User-Agent': 'ParkersApp/1.0 (Language=TypeScript)'
  };

  const signedHeaders = await signRequest('GET', path, queryParams, headers, creds);

  const url = `https://${HOST}${path}?${queryParams.toString()}`;

  console.log('   URL:', url);
  console.log('   Headers:');
  console.log('      x-amz-access-token:', accessToken.substring(0, 30) + '...');
  console.log('      x-amz-security-token:', signedHeaders['x-amz-security-token']?.substring(0, 30) + '...');
  console.log('      Authorization:', signedHeaders['Authorization']?.substring(0, 50) + '...');
  console.log('');

  const response = await fetch(url, {
    method: 'GET',
    headers: signedHeaders
  });

  console.log('📊 Response Status:', response.status);
  console.log('   Request ID:', response.headers.get('x-amzn-requestid'));

  const data = await response.text();

  if (response.ok) {
    console.log('\n✅ SUCCESS! Catalog API works with External ID!');
    console.log('\n📦 Response:');
    console.log(JSON.stringify(JSON.parse(data), null, 2).substring(0, 500));

    console.log('\n🎯 SOLUTION:');
    console.log('   External ID (Seller ID) must be used in AssumeRole!');
    console.log(`   Add ExternalId: "${SELLER_ID}" to AssumeRoleCommand`);
  } else {
    console.log('\n❌ FAILED:', response.status, response.statusText);
    console.log('\n📄 Error Response:');
    try {
      console.log(JSON.stringify(JSON.parse(data), null, 2));
    } catch {
      console.log(data);
    }

    console.log('\n🔍 Analysis:');
    if (response.status === 403) {
      console.log('   • Still 403 even with External ID in AssumeRole');
      console.log('   • This confirms it\'s NOT an AssumeRole configuration issue');
      console.log('   • The problem is OAuth scope/permissions at Amazon\'s level');
    }
  }

  console.log('\n' + '='.repeat(70));
}

testCatalogApi().catch(console.error);
