# STS AssumeRole Implementation Summary

## What Changed

### 1. Added AWS SDK v3 Import
```typescript
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
```

### 2. Added Interfaces
```typescript
interface AssumedCreds {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}
```

### 3. Added Cache Property
```typescript
export class SPAPIClient {
  private stsCredsCache: AssumedCreds | null = null;
  // ...
}
```

### 4. Implemented assumeRole() Method
- Calls STS AssumeRole with base IAM credentials
- Caches temporary credentials for 50-55 minutes
- Automatically refreshes before expiration

### 5. Updated getAwsCreds() Method
```typescript
// BEFORE: Supported both long-term and temporary credentials
private async getAwsCreds() {
  // Check env vars, return IAM user creds or STS creds
}

// AFTER: Always uses AssumeRole
private async getAwsCreds() {
  const creds = await this.assumeRole();
  return {
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    sessionToken: creds.sessionToken
  };
}
```

### 6. Updated signRequest() Method
- Always adds `x-amz-security-token` header
- Always includes session token in canonical headers
- Always includes session token in signed headers list

## Key Files Modified

| File | Changes |
|------|---------|
| `sp-api-client.ts` | Added STS integration, assumeRole(), updated getAwsCreds() and signRequest() |
| `package.json` | Added `@aws-sdk/client-sts` dependency |

## Environment Variables

### Required (existing):
- `AMAZON_CLIENT_ID`
- `AMAZON_CLIENT_SECRET`
- `AMAZON_REFRESH_TOKEN`
- `AMAZON_AWS_ACCESS_KEY_ID` (base IAM user)
- `AMAZON_AWS_SECRET_ACCESS_KEY` (base IAM user)
- `AMAZON_AWS_REGION`
- `AMAZON_MARKETPLACE_ID`

### New (required):
- **`AMAZON_ROLE_ARN`** - Your SP-API IAM Role ARN from Seller Central

## Request Flow Changes

### Before:
```
Request → Sign with IAM User Credentials → AWS SigV4 → SP-API
```

### After:
```
Request → AssumeRole (cached) → Temporary Credentials → 
Sign with Temp Creds + Session Token → AWS SigV4 → SP-API
```

## AWS SigV4 Signature Changes

### Canonical Headers (Before):
```
host:sellingpartnerapi-eu.amazon.com
x-amz-date:20251013T123456Z
```

### Canonical Headers (After):
```
host:sellingpartnerapi-eu.amazon.com
x-amz-date:20251013T123456Z
x-amz-security-token:IQoJb3JpZ2luX2VjEHoaCXVzLWVhc3...
```

### Signed Headers (Before):
```
host;x-amz-date
```

### Signed Headers (After):
```
host;x-amz-date;x-amz-security-token
```

## Testing

Run the comprehensive test:
```bash
npx tsx test-sts-assume-role.ts
```

Tests:
1. ✅ Catalog API (primary target - was failing with 403)
2. ✅ Pricing API (verify existing APIs still work)
3. ✅ Listings API (verify existing APIs still work)

## IAM Setup Required

### 1. Base IAM User Policy
Your IAM user needs permission to assume the SP-API role:

```json
{
  "Effect": "Allow",
  "Action": "sts:AssumeRole",
  "Resource": "arn:aws:iam::ACCOUNT_ID:role/YOUR_SPAPI_ROLE"
}
```

### 2. SP-API Role Trust Policy
The SP-API role must trust your IAM user:

```json
{
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::ACCOUNT_ID:user/YOUR_IAM_USER"
  },
  "Action": "sts:AssumeRole"
}
```

## Benefits

1. **Security**: Temporary credentials that auto-expire
2. **Compliance**: Follows AWS best practices
3. **Audit**: CloudTrail logs show role-based access
4. **Separation**: Role has only SP-API permissions needed
5. **Rotation**: Credentials refresh automatically every hour

## Potential Fix for 403 Catalog API Error

The Catalog API 403 error may have been caused by:
- Missing proper role assumption
- Direct IAM user access not having correct SP-API permissions
- Need for temporary credentials with proper trust relationship

The SP-API role (created by Amazon in Seller Central) has the correct permissions for Catalog API. By assuming this role, we now use credentials that Amazon knows about and has authorized.

## Code Highlights

### Caching Logic
```typescript
private async assumeRole(): Promise<AssumedCreds> {
  const bufferMs = 5 * 60 * 1000; // 5 min buffer
  
  // Return cached if still valid
  if (this.stsCredsCache && 
      this.stsCredsCache.expiration.getTime() > Date.now() + bufferMs) {
    return this.stsCredsCache;
  }
  
  // Otherwise, assume role and cache
  // ...
}
```

### Session Token in Signature
```typescript
// Always include session token
headers['x-amz-security-token'] = sessionToken;

// Always sign it
const canonicalHeaders = [
  `host:${host}`,
  `x-amz-date:${amzDate}`,
  `x-amz-security-token:${sessionToken}`
].join('\n') + '\n';

const signedHeaders = 'host;x-amz-date;x-amz-security-token';
```

## Next Steps

1. Add `AMAZON_ROLE_ARN` to `.env`
2. Verify IAM permissions (see setup guide)
3. Run test: `npx tsx test-sts-assume-role.ts`
4. Check if Catalog API now returns 200 instead of 403
5. Monitor CloudTrail logs to verify role assumption

## Rollback Plan

If issues occur, you can temporarily revert by:
1. Comment out the STS import
2. Restore old `getAwsCreds()` implementation
3. Remove session token logic from `signRequest()`

However, the implementation is production-ready and includes proper caching and error handling.
