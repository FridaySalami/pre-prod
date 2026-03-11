# STS AssumeRole Setup Guide

## Overview

The SP-API client now uses **AWS STS (Security Token Service) AssumeRole** for all signed API requests. This provides temporary credentials that are more secure than long-term IAM user keys.

## How It Works

1. **Base IAM User Credentials** → AssumeRole → **Temporary Credentials (1 hour)**
2. Temporary credentials are cached and automatically refreshed (5 min buffer)
3. Every SP-API request uses fresh temporary credentials with `x-amz-security-token`

## Required Setup

### 1. Find Your SP-API Role ARN

Your SP-API Role ARN is provided by Amazon when you registered for SP-API access in Seller Central.

#### Option A: From Seller Central
1. Go to **Settings → User Permissions**
2. Find **Amazon MWS Developer Permissions** or **SP-API**
3. Look for the **IAM Role ARN**
   - Format: `arn:aws:iam::123456789012:role/SellerCentralSPAPIRole`

#### Option B: From AWS IAM Console
1. Go to AWS IAM Console → **Roles**
2. Search for "SellerCentral" or "SPAPI"
3. Click on the role
4. Copy the **ARN** at the top

#### Option C: From SP-API Application Details
1. In Seller Central, go to **Partner Network → Develop Apps**
2. Click **View** on your registered application
3. Find **IAM ARN** under credentials section

### 2. Add Role ARN to .env

Add this to your `.env` file:

```bash
# STS AssumeRole Configuration
AMAZON_ROLE_ARN=arn:aws:iam::YOUR_ACCOUNT_ID:role/YOUR_SPAPI_ROLE_NAME

# Example:
AMAZON_ROLE_ARN=arn:aws:iam::123456789012:role/SellerCentralSPAPIRole
```

### 3. Verify IAM User Has AssumeRole Permission

Your base IAM user (the one with `AMAZON_AWS_ACCESS_KEY_ID`) needs permission to assume the SP-API role.

**Required IAM Policy for Base User:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::123456789012:role/SellerCentralSPAPIRole"
    }
  ]
}
```

### 4. Verify Trust Relationship on SP-API Role

The SP-API role must trust your IAM user to assume it.

**Trust Policy on SP-API Role:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:user/your-iam-user-name"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

## Testing

Run the test script to verify everything works:

```bash
npx tsx test-sts-assume-role.ts
```

Expected output:
```
🔐 Testing STS AssumeRole Integration

✅ All required environment variables present
   Role ARN: arn:aws:iam::123456789012:role/SellerCentralSPAPIRole

📦 Test 1: Catalog API
   ✅ SUCCESS! Catalog API now works with STS AssumeRole

💰 Test 2: Pricing API
   ✅ SUCCESS! Pricing API still works with STS

📝 Test 3: Listings API
   ✅ SUCCESS! Listings API works

🎉 STS AssumeRole Integration Complete!
```

## Troubleshooting

### Error: "Missing AMAZON_ROLE_ARN"
- Add `AMAZON_ROLE_ARN` to your `.env` file

### Error: "AssumeRole failed: User ... is not authorized to perform: sts:AssumeRole"
- Your base IAM user needs the `sts:AssumeRole` permission
- Add the IAM policy shown in step 3 above

### Error: "AssumeRole failed: AccessDenied"
- The SP-API role's trust policy doesn't allow your IAM user
- Update the trust policy as shown in step 4 above

### Error: "AssumeRole failed: no credentials returned"
- Check that the role ARN is correct
- Verify the role exists in your AWS account

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SP-API Request Flow                      │
└─────────────────────────────────────────────────────────────┘

1. Application calls SPAPIClient.get()
   │
   ├─> getAwsCreds()
   │    │
   │    └─> assumeRole() [if cache expired]
   │         │
   │         ├─> STS.AssumeRole(roleArn)
   │         │   └─> Returns: accessKeyId, secretAccessKey, sessionToken
   │         │
   │         └─> Cache for 50-55 minutes
   │
   ├─> signRequest(tempCreds)
   │    │
   │    ├─> Add x-amz-security-token header
   │    ├─> Build canonical request (includes session token)
   │    └─> Sign with AWS SigV4 (temporary credentials)
   │
   └─> Make API request with signed headers
```

## Benefits

✅ **Enhanced Security**: Temporary credentials expire automatically  
✅ **Least Privilege**: Role can have minimal permissions needed  
✅ **Audit Trail**: CloudTrail logs show which role made requests  
✅ **Compliance**: Follows AWS security best practices  
✅ **Automatic Rotation**: Credentials refresh every hour  

## Migration Notes

### Before (Direct IAM User)
```typescript
// Used long-term credentials directly
const { accessKeyId, secretAccessKey } = config;
```

### After (STS AssumeRole)
```typescript
// Always gets temporary credentials via AssumeRole
const creds = await this.assumeRole();
const { accessKeyId, secretAccessKey, sessionToken } = creds;
```

All existing code continues to work - the changes are internal to `SPAPIClient`.

## Additional Resources

- [AWS STS AssumeRole Documentation](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)
- [Amazon SP-API Authorization](https://developer-docs.amazon.com/sp-api/docs/sp-api-authorization)
- [IAM Roles Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#bp-users-federation-idp)
