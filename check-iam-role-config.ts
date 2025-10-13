/**
 * Final Diagnostic: Check if we have an IAM Role ARN configured
 * 
 * Some seller accounts require IAM role-based access for certain APIs.
 * This test checks if AMAZON_ROLE_ARN is configured and if AssumeRole is needed.
 */

import 'dotenv/config';

async function checkIAMRoleConfiguration() {
  console.log('🔍 IAM Role Configuration Check\n');
  console.log('='.repeat(70));

  const roleArn = process.env.AMAZON_ROLE_ARN;

  if (!roleArn) {
    console.log('❌ AMAZON_ROLE_ARN not found in .env\n');
    console.log('📋 This could be why Catalog API is denied!\n');
    console.log('💡 Some seller accounts require IAM Role-based access for Catalog API.');
    console.log('   This is different from the LWA OAuth refresh token.\n');

    console.log('🔍 Where to find your IAM Role ARN:');
    console.log('   1. Go to Seller Central → Apps & Services → Develop Apps');
    console.log('   2. Click "View" or "Edit App" on your application');
    console.log('   3. Look for "IAM ARN" field in the credentials section');
    console.log('   4. Copy the ARN (format: arn:aws:iam::ACCOUNT:role/ROLE_NAME)');
    console.log('   5. Add to .env: AMAZON_ROLE_ARN=arn:aws:iam::...\n');

    console.log('⚠️  If you see an IAM ARN in Seller Central but it\'s not in .env,');
    console.log('   that\'s likely why Catalog API returns 403.\n');

    console.log('📌 Two Types of Amazon SP-API Authorization:');
    console.log('   1. LWA OAuth (refresh token) - Used directly for some APIs ✅');
    console.log('   2. IAM Role (AssumeRole) - Required for sensitive APIs like Catalog ⚠️\n');

    console.log('🔬 Current Status:');
    console.log('   ✅ AMAZON_REFRESH_TOKEN: Present');
    console.log('   ✅ AMAZON_AWS_ACCESS_KEY_ID: Present (for AssumeRole)');
    console.log('   ✅ AMAZON_AWS_SECRET_ACCESS_KEY: Present (for AssumeRole)');
    console.log('   ❌ AMAZON_ROLE_ARN: MISSING\n');

    console.log('='.repeat(70));
    return false;
  }

  console.log('✅ AMAZON_ROLE_ARN found!\n');
  console.log(`   ARN: ${roleArn}\n`);

  // Validate ARN format
  const arnRegex = /^arn:aws:iam::\d{12}:role\/[\w+=,.@-]+$/;
  if (!arnRegex.test(roleArn)) {
    console.log('⚠️  WARNING: ARN format looks invalid');
    console.log('   Expected format: arn:aws:iam::123456789012:role/RoleName\n');
  } else {
    console.log('✅ ARN format is valid\n');
  }

  console.log('🧪 You can now test STS AssumeRole approach:');
  console.log('   npx tsx test-sts-assume-role.ts\n');

  console.log('='.repeat(70));
  return true;
}

async function checkAllCredentials() {
  console.log('📋 Complete Credential Audit\n');

  const credentials = {
    'LWA Client ID': process.env.AMAZON_CLIENT_ID,
    'LWA Client Secret': process.env.AMAZON_CLIENT_SECRET,
    'LWA Refresh Token': process.env.AMAZON_REFRESH_TOKEN,
    'AWS Access Key ID': process.env.AMAZON_AWS_ACCESS_KEY_ID,
    'AWS Secret Access Key': process.env.AMAZON_AWS_SECRET_ACCESS_KEY,
    'AWS Region': process.env.AMAZON_AWS_REGION,
    'Marketplace ID': process.env.AMAZON_MARKETPLACE_ID,
    'Seller ID': process.env.AMAZON_SELLER_ID,
    'IAM Role ARN': process.env.AMAZON_ROLE_ARN
  };

  console.log('Credential Status:');
  Object.entries(credentials).forEach(([name, value]) => {
    if (value) {
      const display = value.length > 30 ? value.substring(0, 30) + '...' : value;
      console.log(`   ✅ ${name.padEnd(25)}: ${display}`);
    } else {
      console.log(`   ❌ ${name.padEnd(25)}: MISSING`);
    }
  });

  console.log('\n' + '='.repeat(70));
}

async function main() {
  await checkAllCredentials();
  console.log();
  await checkIAMRoleConfiguration();

  console.log('\n💡 Next Steps:');
  console.log('   1. Check Seller Central for IAM ARN');
  console.log('   2. Add AMAZON_ROLE_ARN to .env if found');
  console.log('   3. Test with: npx tsx test-sts-assume-role.ts');
  console.log('   4. If still 403, contact Amazon SP-API Support\n');
}

main();
