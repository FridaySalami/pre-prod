#!/usr/bin/env node

/**
 * Verify AWS Credentials Match
 * Check if the credentials in .env match what's being used
 */

import { config } from 'dotenv';

config();

const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION;

console.log('🔍 AWS CREDENTIALS VERIFICATION');
console.log('==============================');
console.log('');
console.log('📋 Credentials from your .env file:');
console.log('AWS_ACCESS_KEY_ID:', AWS_ACCESS_KEY);
console.log('AWS_SECRET_ACCESS_KEY:', AWS_SECRET_KEY?.substring(0, 10) + '...');
console.log('AWS_REGION:', AWS_REGION);
console.log('');
console.log('📋 From your AWS IAM screenshot:');
console.log('User: amazon-spapi-user');
console.log('Access Key visible: AKIA42O653N2YDPEKDCM (from screenshot)');
console.log('');
console.log('🔍 COMPARISON:');
console.log('Your .env file: ', AWS_ACCESS_KEY);
console.log('AWS IAM screen:  AKIA42O653N2YDPEKDCM');
console.log('');

if (AWS_ACCESS_KEY === 'AKIA42O653N2YDPEKDCM') {
  console.log('✅ MATCH: Credentials match the AWS IAM user in screenshot');
  console.log('');
  console.log('🎯 SOLUTION: Add permissions to the "amazon-spapi-user" in AWS IAM:');
  console.log('1. Click "Add permissions" on the IAM user');
  console.log('2. Search for and attach FBA/Inventory policies');
  console.log('3. Or create a custom policy for SP-API endpoints');
} else if (AWS_ACCESS_KEY === 'AKIA42O6I3N2YDPEKDCM') {
  console.log('❌ MISMATCH: Your .env uses different credentials than shown in AWS IAM');
  console.log('');
  console.log('🎯 SOLUTIONS:');
  console.log('1. Find the correct AWS IAM user for key: ' + AWS_ACCESS_KEY);
  console.log('2. OR update .env to use the amazon-spapi-user credentials');
  console.log('3. OR create new access keys for amazon-spapi-user and update .env');
} else {
  console.log('🤔 Neither key matches exactly - there might be a typo or different user');
  console.log('');
  console.log('🎯 RECOMMENDATIONS:');
  console.log('1. Double-check the access key in AWS IAM console');
  console.log('2. Regenerate access keys for amazon-spapi-user');
  console.log('3. Update your .env file with the correct credentials');
}

console.log('');
console.log('💡 TIP: The "Never used" status suggests either:');
console.log('   - Wrong credentials in .env file');
console.log('   - SP-API using different authentication method');
console.log('   - Need to use the correct AWS IAM user for SP-API');
