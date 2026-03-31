
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// Configuration
const config = {
  clientId: process.env.AMAZON_CLIENT_ID,
  clientSecret: process.env.AMAZON_CLIENT_SECRET,
  refreshToken: process.env.AMAZON_REFRESH_TOKEN,
  marketplace: 'A1F83G8C2ARO7P', // UK marketplace
  endpoint: 'sellingpartnerapi-eu.amazon.com',
  region: 'eu-west-1',
  accessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY
};

const skus = [
  "ACC01 - 001",
  "ACC01 - 001 uk shipping",
  "ACC01 - 002 Prime",
  "ACC01 - 003 Prime",
  "ACC01 - 004",
  "ACC01 - 005 Prime",
  "ACC02 - 001",
  "ACC02 - 001 uk shipping"
];

async function getAccessToken() {
  try {
    const response = await axios.post('https://api.amazon.com/auth/o2/token', {
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Failed to get Amazon access token:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with Amazon SP-API');
  }
}

function getSignature(method, path, queryParams, headers, body, accessToken) {
  const amzDate = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const service = 'execute-api';
  const region = config.region;
  const host = config.endpoint;

  const updatedHeaders = {
    ...headers,
    'host': host,
    'x-amz-date': amzDate,
    'x-amz-access-token': accessToken
  };

  const canonicalUri = path;
  const canonicalQueryString = Object.keys(queryParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
    .join('&');

  const canonicalHeaders = Object.keys(updatedHeaders)
    .sort()
    .map(key => `${key.toLowerCase()}:${updatedHeaders[key]}`)
    .join('\n') + '\n';

  const signedHeaders = Object.keys(updatedHeaders)
    .sort()
    .map(key => key.toLowerCase())
    .join(';');

  const payloadHash = crypto.createHash('sha256').update(body).digest('hex');

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  const kDate = crypto.createHmac('sha256', `AWS4${config.secretAccessKey}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(region).digest(); // Wait, region here? Let me re-check typical AWS sig4
  // Correction: kDate -> kRegion -> kService -> kSigning
  // Let me use a more standard implementation or re-verify. 
  // Actually, KService uses kRegion. 
  const kService_fixed = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService_fixed).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorizationHeader = `${algorithm} Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...updatedHeaders,
    'Authorization': authorizationHeader
  };
}

async function testListingOffersBatch() {
  console.log('Starting SP-API Batch Listing Offers test...');
  
  try {
    const accessToken = await getAccessToken();
    console.log('Access token acquired.');

    const method = 'POST';
    const path = '/batches/products/pricing/v0/listingOffers';
    
    // Construct batch requests
    const requests = skus.map(sku => ({
      // Using query parameters for batch requests as sometimes required or better handled
      uri: `/products/pricing/v0/listings/${encodeURIComponent(sku)}/offers`,
      method: 'GET',
      queryParams: {
        'MarketplaceId': config.marketplace,
        'ItemCondition': 'New',
        'CustomerType': 'Consumer'
      }
    }));

    const body = JSON.stringify({ requests });
    
    // AWS Signature V4 stuff
    const amzDate = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const service = 'execute-api';
    const region = config.region;
    const host = config.endpoint;

    const headers = {
      'host': host,
      'x-amz-date': amzDate,
      'x-amz-access-token': accessToken,
      'content-type': 'application/json'
    };

    const canonicalUri = path;
    const canonicalQueryString = ''; // No query params for this POST
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map(key => `${key.toLowerCase()}:${headers[key]}`)
      .join('\n') + '\n';

    const signedHeaders = Object.keys(headers)
      .sort()
      .map(key => key.toLowerCase())
      .join(';');

    const payloadHash = crypto.createHash('sha256').update(body).digest('hex');

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    function getSignatureKey(key, dateStamp, regionName, serviceName) {
      const kDate = crypto.createHmac('sha256', "AWS4" + key).update(dateStamp).digest();
      const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
      const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
      const kSigning = crypto.createHmac('sha256', kService).update("aws4_request").digest();
      return kSigning;
    }

    const signingKey = getSignatureKey(config.secretAccessKey, dateStamp, region, service);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const authorizationHeader = `${algorithm} Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const url = `https://${host}${path}`;
    console.log(`Calling URL: ${url}`);

    const response = await axios.post(url, body, {
      headers: {
        ...headers,
        'Authorization': authorizationHeader
      }
    });

    console.log('Response Status:', response.status);
    console.log('Batch Results:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('Error in test:', error.response?.data || error.message);
  }
}

testListingOffersBatch();
