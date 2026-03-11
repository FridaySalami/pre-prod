/**
 * IAM Role Permission Checker
 * 
 * Your IAM role needs specific permissions to access SP-API.
 * This script shows what should be configured.
 */

import 'dotenv/config';

function checkRoleConfiguration() {
  console.log('🔍 IAM Role Configuration Guide\n');
  console.log('='.repeat(70));

  const roleArn = process.env.AMAZON_ROLE_ARN;
  console.log('✅ Role ARN Found:', roleArn);
  console.log('✅ Trust Relationship: Configured (amazon-spapi-user can assume role)\n');

  console.log('='.repeat(70));
  console.log('📋 REQUIRED: IAM Role Permissions Policy\n');

  console.log('The role needs the "execute-api:Invoke" permission for SP-API.');
  console.log('Go to AWS IAM Console and attach this policy to your role:\n');

  console.log('Policy Name: SellingPartnerAPI-ExecutePolicy\n');

  console.log('Policy JSON:');
  console.log('```json');
  console.log(JSON.stringify({
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": "execute-api:Invoke",
        "Resource": "arn:aws:execute-api:*:*:*"
      }
    ]
  }, null, 2));
  console.log('```\n');

  console.log('='.repeat(70));
  console.log('📝 Steps to Add Permissions:\n');

  console.log('1. Go to AWS IAM Console: https://console.aws.amazon.com/iam/');
  console.log('2. Click "Roles" in the left sidebar');
  console.log('3. Find and click: SellingPartnerAPI-Role');
  console.log('4. Click "Add permissions" → "Create inline policy"');
  console.log('5. Switch to JSON tab');
  console.log('6. Paste the policy JSON above');
  console.log('7. Click "Review policy"');
  console.log('8. Name it: SellingPartnerAPI-ExecutePolicy');
  console.log('9. Click "Create policy"\n');

  console.log('='.repeat(70));
  console.log('🔐 OR Use AWS-Managed Policy (Easier):\n');

  console.log('Instead of creating inline policy, you can attach managed policy:');
  console.log('1. In the role, click "Add permissions" → "Attach policies"');
  console.log('2. Search for: AmazonAPIGatewayInvokeFullAccess');
  console.log('3. Check the box and click "Add permissions"\n');

  console.log('⚠️  NOTE: This gives broader API Gateway access than needed,');
  console.log('   but it\'s simpler. For production, use the specific policy above.\n');

  console.log('='.repeat(70));
  console.log('🧪 After Adding Permissions:\n');

  console.log('Run this command to test again:');
  console.log('   npx tsx test-sts-assume-role.ts\n');

  console.log('If Catalog API still returns 403 after adding execute-api:Invoke,');
  console.log('then the issue is definitely OAuth scope, not IAM permissions.\n');

  console.log('='.repeat(70));
  console.log('📊 Current Status:\n');

  console.log('✅ IAM Role Created: SellingPartnerAPI-Role');
  console.log('✅ Trust Relationship: amazon-spapi-user can assume role');
  console.log('✅ STS AssumeRole: Working (credentials obtained)');
  console.log('✅ Pricing API: Works with assumed role');
  console.log('✅ Listings API: Works with assumed role');
  console.log('❌ Catalog API: Still 403 (might need execute-api:Invoke)');
  console.log('❓ Role Permissions: NEEDS VERIFICATION\n');

  console.log('='.repeat(70));
}

checkRoleConfiguration();
