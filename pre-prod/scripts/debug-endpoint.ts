/**
 * Debug SP-API endpoint resolution
 */

import { config } from 'dotenv';
config();

import { SPAPIClient } from './src/lib/amazon/index.js';

async function debugEndpoint() {
  console.log('🔍 Debugging SP-API Endpoint Resolution\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`   AMAZON_AWS_REGION: ${process.env.AMAZON_AWS_REGION}`);
  console.log(`   AMAZON_REGION: ${process.env.AMAZON_REGION}`);
  console.log(`   AMAZON_MARKETPLACE_ID: ${process.env.AMAZON_MARKETPLACE_ID}\n`);

  // Create client
  const client = SPAPIClient.fromEnv();

  // Access private config via type assertion to check what's set
  const config = (client as any).config;
  console.log('🔧 Client Configuration:');
  console.log(`   awsRegion: ${config.awsRegion}`);
  console.log(`   marketplaceId: ${config.marketplaceId}\n`);

  // Check endpoint mapping
  const endpoints = (client as any).REGIONAL_ENDPOINTS;
  console.log('🌍 Regional Endpoints Mapping:');
  console.log(`   eu-west-1: ${endpoints['eu-west-1']}`);
  console.log(`   us-east-1: ${endpoints['us-east-1']}`);
  console.log(`   us-west-2: ${endpoints['us-west-2']}\n`);

  // Get the endpoint that would be used
  const endpoint = endpoints[config.awsRegion];
  console.log('✅ Selected Endpoint:');
  console.log(`   ${endpoint}\n`);

  // Construct a sample URL
  const testAsin = 'B08BPCC8WD';
  const path = `/catalog/2022-04-01/items/${testAsin}`;
  const fullUrl = `${endpoint}${path}?marketplaceIds=A1F83G8C2ARO7P`;

  console.log('🔗 Sample Catalog API URL:');
  console.log(`   ${fullUrl}\n`);

  // Check if it matches what you saw
  if (fullUrl.includes('sellingpartnerapi-eu.amazon.com')) {
    console.log('✅ CORRECT: Using EU endpoint');
  } else if (fullUrl.includes('sellingpartnerapi-na.amazon.com')) {
    console.log('❌ WRONG: Using NA endpoint (should be EU)');
  } else {
    console.log('⚠️  UNKNOWN: Using unexpected endpoint');
  }
}

debugEndpoint();
