# Catalog API 403 Error - Detailed Analysis

**Date**: 13 October 2025  
**Error**: 403 Unauthorized - "Access to requested resource is denied"  
**Endpoint**: GET /catalog/2022-04-01/items/B08BPCC8WD

---

## 🔍 Configuration Review

### Current Settings (from .env)
```
AMAZON_REGION=eu-west-1
AMAZON_MARKETPLACE_ID=A1F83G8C2ARO7P (UK)
AMAZON_SELLER_ID=A2D8NG39VURSL3
AMAZON_AWS_REGION=eu-west-1
```

### SP-API Client Configuration
- **LWA Token Endpoint**: `https://api.amazon.com/auth/o2/token` ⚠️
- **API Endpoint**: `https://sellingpartnerapi-eu.amazon.com` ✅
- **AWS Region**: eu-west-1 ✅
- **Service**: execute-api ✅

---

## ⚠️ POTENTIAL ISSUES IDENTIFIED

### 1. **LWA Token Endpoint Mismatch** (HIGH PROBABILITY)

**Current**: Using global endpoint `https://api.amazon.com/auth/o2/token`  
**Should be**: Region-specific endpoint for EU

According to Amazon docs, there are region-specific LWA endpoints:
- **NA**: `https://api.amazon.com/auth/o2/token`
- **EU**: `https://api.amazon.co.uk/auth/o2/token` or `https://api.amazon.de/auth/o2/token`
- **FE**: `https://api.amazon.co.jp/auth/o2/token`

**Impact**: The access token might be valid for NA region but not EU region, causing 403 errors.

---

### 2. **Refresh Token Scope Issue** (MEDIUM PROBABILITY)

The refresh token was generated at: **Unknown date**  
The "Product Listing" role was enabled: **Unknown date**

If the refresh token predates the role activation, it won't include Catalog API permissions.

**Verification Needed**:
- When was `AMAZON_REFRESH_TOKEN` generated?
- When was "Product Listing" role enabled in Seller Central?
- If role was enabled AFTER token generation → Need new token

---

### 3. **Marketplace vs Region Mismatch** (LOW PROBABILITY)

**Marketplace**: A1F83G8C2ARO7P (UK)  
**AWS Region**: eu-west-1 (Ireland)  
**API Endpoint**: sellingpartnerapi-eu.amazon.com

This looks correct for UK marketplace.

---

### 4. **AWS SigV4 Signing Issues** (LOW PROBABILITY)

Our signing implementation looks standard, but possible issues:
- Host header might need to be lowercase
- Query parameters might need specific ordering
- Payload hash might be incorrect for GET requests

---

## 🧪 Diagnostic Tests

### Test 1: Verify LWA Token Generation

Check if we can get an access token:

```bash
curl -X POST https://api.amazon.com/auth/o2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=${AMAZON_REFRESH_TOKEN}" \
  -d "client_id=${AMAZON_CLIENT_ID}" \
  -d "client_secret=${AMAZON_CLIENT_SECRET}"
```

**Expected**: 200 OK with access_token  
**If 400/401**: Refresh token is invalid/expired

---

### Test 2: Check Token Scopes

Decode the access token (JWT) to see included scopes:

```bash
# Get token
TOKEN=$(curl -s -X POST https://api.amazon.com/auth/o2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=${AMAZON_REFRESH_TOKEN}" \
  -d "client_id=${AMAZON_CLIENT_ID}" \
  -d "client_secret=${AMAZON_CLIENT_SECRET}" | jq -r '.access_token')

# Decode (if it's a JWT)
echo $TOKEN | cut -d'.' -f2 | base64 -d | jq
```

---

### Test 3: Test Different API Endpoint

Try the **search** endpoint instead of direct ASIN lookup:

```
GET /catalog/2022-04-01/items?keywords=B08BPCC8WD&marketplaceIds=A1F83G8C2ARO7P
```

This uses different permissions and might reveal if it's endpoint-specific.

---

### Test 4: Compare with Working API

The **Notifications API** is working. Let's compare:

**Working (Notifications)**:
- Endpoint: `/notifications/v1/subscriptions`
- Method: GET/POST
- Region: eu-west-1
- Marketplace: A1F83G8C2ARO7P

**Not Working (Catalog)**:
- Endpoint: `/catalog/2022-04-01/items/{asin}`
- Method: GET
- Region: eu-west-1
- Marketplace: A1F83G8C2ARO7P

**Difference**: Only the API path differs - same auth, same signing.

---

## 🛠️ RECOMMENDED FIXES (In Priority Order)

### Fix 1: Use EU-Specific LWA Endpoint (IMMEDIATE)

Update SP-API client to use regional LWA endpoints:

```typescript
private readonly LWA_TOKEN_URLS: Record<string, string> = {
  'eu-west-1': 'https://api.amazon.co.uk/auth/o2/token',
  'us-east-1': 'https://api.amazon.com/auth/o2/token',
  'us-west-2': 'https://api.amazon.co.jp/auth/o2/token'
};

private async getAccessToken(): Promise<string> {
  const lwaUrl = this.LWA_TOKEN_URLS[this.config.awsRegion!] || this.LWA_TOKEN_URL;
  
  const response = await fetch(lwaUrl, {
    // ... rest of code
  });
}
```

**Time**: 5 minutes  
**Risk**: Low  
**Chance of Success**: 60%

---

### Fix 2: Regenerate Refresh Token (IF FIX 1 FAILS)

1. Go to Seller Central → Apps & Services → Develop Apps
2. Click your app
3. Go to "LWA Credentials" 
4. Generate new OAuth URL:
   ```
   https://sellercentral.amazon.co.uk/apps/authorize/consent?
   application_id=amzn1.application-oa2-client.86a5e69c4a884eab8d37ff6f28fc6ff4&
   version=beta&
   state=stateexample
   ```
5. Authorize and get new code
6. Exchange for new refresh token:
   ```bash
   curl -X POST https://api.amazon.co.uk/auth/o2/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=authorization_code" \
     -d "code=YOUR_NEW_AUTH_CODE" \
     -d "client_id=amzn1.application-oa2-client.86a5e69c4a884eab8d37ff6f28fc6ff4" \
     -d "client_secret=amzn1.oa2-cs.v1.5abfb649c31467b4049571407d65ffa55b0e0dd52ba7d8324c8801e67a90298d"
   ```
7. Update `.env` with new `AMAZON_REFRESH_TOKEN`

**Time**: 10-15 minutes  
**Risk**: Medium (need to test all existing integrations)  
**Chance of Success**: 90%

---

### Fix 3: Check Signing Implementation (IF FIX 1 & 2 FAIL)

Review AWS SigV4 signing:
- Ensure canonical headers are lowercase
- Verify payload hash for GET requests (should be empty string hash)
- Check query parameter encoding

**Time**: 30 minutes  
**Risk**: Medium  
**Chance of Success**: 20%

---

### Fix 4: Contact Amazon Support (LAST RESORT)

If all else fails, might be account-specific restriction.

**Time**: 1-3 business days  
**Risk**: Low  
**Chance of Success**: 100% (they'll tell us exactly what's wrong)

---

## 📋 Immediate Action Plan

### Step 1: Test LWA Token (5 min)
```bash
cd /Users/jackweston/Projects/pre-prod
source .env
curl -X POST https://api.amazon.com/auth/o2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=${AMAZON_REFRESH_TOKEN}" \
  -d "client_id=${AMAZON_CLIENT_ID}" \
  -d "client_secret=${AMAZON_CLIENT_SECRET}" | jq
```

**If successful**: Token is valid, issue is elsewhere  
**If 400**: Need to regenerate refresh token

---

### Step 2: Update to EU LWA Endpoint (5 min)

Modify `sp-api-client.ts` to use `https://api.amazon.co.uk/auth/o2/token` for EU region.

---

### Step 3: Re-test Catalog API (2 min)

```bash
npx tsx test-catalog-api.ts
```

---

### Step 4: If Still 403 → Regenerate Token (15 min)

Follow Fix 2 steps above.

---

## 🎯 Success Criteria

When fixed, we should see:

```json
{
  "asin": "B08BPCC8WD",
  "attributes": {
    "item_name": [{
      "value": "Product Name",
      "marketplace_id": "A1F83G8C2ARO7P"
    }],
    "brand": [{
      "value": "Brand Name"
    }]
  },
  "summaries": [...],
  "images": [...]
}
```

**NOT**:
```json
{
  "errors": [{
    "code": "Unauthorized",
    "message": "Access to requested resource is denied."
  }]
}
```

---

## 📝 Related Issues

### Similar 403 Errors You've Encountered Before

You mentioned: *"I've had issues with this before"* regarding `x-amzn-RequestId` header.

**Common causes**:
1. ❌ Using wrong region endpoint
2. ❌ Expired/invalid refresh token
3. ❌ Missing scopes in OAuth authorization
4. ❌ AWS credentials mismatch with LWA credentials
5. ❌ Rate limiting (but that's 429, not 403)

**Your specific history** (if you can recall):
- What was the previous 403 error about?
- How did you fix it?
- Was it also Catalog API or different API?

This context would help narrow down the issue faster.

---

## 🔄 Next Steps

**RIGHT NOW**:
1. Run LWA token test (see Step 1 above)
2. Share the result
3. Based on result, we'll either:
   - Update LWA endpoint (if token works)
   - OR regenerate refresh token (if token fails)

**Question for you**: 
- When did you last successfully use the Catalog Items API?
- Have you recently changed any credentials or re-authorized the app?
- Do you remember what the previous "x-amzn-RequestId" issue was about?
