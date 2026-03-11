/**
 * Check IAM configuration and determine if STS session token is needed
 */

import 'dotenv/config';

console.log('🔐 AWS IAM Configuration Check\n');
console.log('═══════════════════════════════════════════════════════════\n');

const awsAccessKeyId = process.env.AMAZON_AWS_ACCESS_KEY_ID;
const awsSecretAccessKey = process.env.AMAZON_AWS_SECRET_ACCESS_KEY;
const awsSessionToken = process.env.AMAZON_AWS_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN;

console.log('📋 Current AWS Credentials:\n');
console.log(`Access Key ID: ${awsAccessKeyId?.substring(0, 20)}...`);
console.log(`Secret Key: ${awsSecretAccessKey ? '***SET***' : 'NOT SET'}`);
console.log(`Session Token: ${awsSessionToken || 'NOT SET (❌ This might be the problem!)'}\n`);

console.log('═══════════════════════════════════════════════════════════\n');

console.log('🔍 IAM Entity Type Detection:\n');

if (awsAccessKeyId?.startsWith('AKIA')) {
  console.log('✅ IAM User Detected (Access Key starts with AKIA)\n');
  console.log('For IAM Users:');
  console.log('   • Policies must be DIRECTLY attached to the user');
  console.log('   • No session token needed');
  console.log('   • Your current setup is correct for IAM users\n');

  console.log('⚠️  However, if Catalog API still fails:');
  console.log('   1. Check IAM user has execute-api:Invoke permission');
  console.log('   2. Verify no SCPs (Service Control Policies) blocking access');
  console.log('   3. The issue is likely OAuth scope, not IAM\n');

} else if (awsAccessKeyId?.startsWith('ASIA')) {
  console.log('⚠️  TEMPORARY CREDENTIALS Detected (Access Key starts with ASIA)\n');
  console.log('This means you\'re using an IAM Role with STS!\n');

  if (!awsSessionToken) {
    console.log('❌ PROBLEM FOUND: Session Token is MISSING!\n');
    console.log('For IAM Roles with temporary credentials:');
    console.log('   • You MUST include AWS_SESSION_TOKEN');
    console.log('   • Temporary credentials have 3 parts:');
    console.log('     1. Access Key (ASIA...)');
    console.log('     2. Secret Key');
    console.log('     3. Session Token (❌ MISSING)\n');

    console.log('🔧 FIX: Add session token to .env:');
    console.log('   AMAZON_AWS_SESSION_TOKEN=your_session_token_here\n');

    console.log('Or switch to IAM User credentials (starts with AKIA).\n');
  } else {
    console.log('✅ Session token is present\n');
    console.log('Configuration looks correct for IAM Role.\n');
  }

} else {
  console.log('❓ Unknown Access Key format\n');
  console.log(`Key starts with: ${awsAccessKeyId?.substring(0, 4)}\n`);
}

console.log('═══════════════════════════════════════════════════════════\n');

console.log('📝 IAM Policy Requirements:\n');

console.log('Your IAM entity needs execute-api:Invoke for SP-API:');
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

console.log('🔍 Next Steps:\n');

if (awsAccessKeyId?.startsWith('ASIA') && !awsSessionToken) {
  console.log('1. ❌ ADD SESSION TOKEN to .env (critical!)');
  console.log('2. Or switch to IAM User credentials');
  console.log('3. Re-test Catalog API\n');
} else if (awsAccessKeyId?.startsWith('AKIA')) {
  console.log('1. ✅ IAM User setup is correct');
  console.log('2. Verify IAM user has execute-api:Invoke permission');
  console.log('3. Check IAM policies in AWS Console (screenshot shows them)');
  console.log('4. Issue is likely OAuth scope, not IAM\n');

  console.log('📸 Recommendation:');
  console.log('   Take screenshot of authorization page showing ALL');
  console.log('   permission checkboxes. Look for separate "Catalog"');
  console.log('   permission different from "Listings".\n');
}

console.log('═══════════════════════════════════════════════════════════\n');
