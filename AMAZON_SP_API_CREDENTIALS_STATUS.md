# Amazon SP-API Credentials Status

**Date**: 13 October 2025  
**Purpose**: Document current SP-API setup and required credentials for roadmap implementation

---

## 📋 Current Environment Variables

Based on analysis of the codebase, the following environment variables are used:

### ✅ Currently Required (Working)
```bash
# LWA (Login with Amazon) Credentials
AMAZON_CLIENT_ID=           # SP-API Application Client ID
AMAZON_CLIENT_SECRET=       # SP-API Application Client Secret
AMAZON_REFRESH_TOKEN=       # OAuth Refresh Token

# AWS IAM Credentials
AMAZON_AWS_ACCESS_KEY_ID=       # AWS Access Key for signing requests
AMAZON_AWS_SECRET_ACCESS_KEY=   # AWS Secret Key for signing requests
AMAZON_AWS_REGION=              # Default: eu-west-1 (UK)

# Marketplace
AMAZON_MARKETPLACE_ID=          # Default: A1F83G8C2ARO7P (UK)
```

### 🎯 Current API Scopes (Active)
Based on existing OAuth setup in `/src/routes/api/amazon/oauth/authorize/+server.ts`:

```
sellingpartnerapi::notifications  ✅ (Currently working)
sellingpartnerapi::migration      ✅ (Currently working)
```

---

## 🚀 Additional Scopes Needed for Roadmap

To complete the product page roadmap, we need to ensure these additional scopes are enabled:

### Phase 2: Product Catalog Integration
```
sellingpartnerapi::catalog       ⚠️ NEEDED
```
**Required for**:
- Product details (title, brand, images)
- Dimensions & weight
- Category information
- Feature bullets
- BSR data

### Phase 3: Sales & Traffic Reports
```
sellingpartnerapi::reports       ⚠️ NEEDED
```
**Required for**:
- Sales & Traffic Report
- 30-day revenue data
- Unit sales data
- Conversion rates
- Session data

### Phase 5: FBA Fees
```
sellingpartnerapi::fees          ⚠️ NEEDED
```
**Required for**:
- FBA fee estimation
- Referral fee calculation
- Profitability analysis

### Phase (Optional): Listings Management
```
sellingpartnerapi::listings      ⚠️ OPTIONAL
```
**Required for**:
- Listing quality issues
- Suppressed listing detection
- Content health analysis

---

## 🔍 How to Verify Current Scopes

### Option 1: Check Seller Central
1. Go to https://sellercentral.amazon.co.uk/apps/manage
2. Find your SP-API application
3. Check the "API Sections" enabled
4. Look for:
   - ✅ Notifications (should be enabled)
   - ⚠️ Catalog Items
   - ⚠️ Reports
   - ⚠️ Product Fees
   - ⚠️ Listings Items

### Option 2: Test API Call
Run the diagnostics endpoint:
```bash
GET /api/amazon/diagnostics
```

This will show which credentials are set (not the values, just status).

### Option 3: Try an API Call
Test with a simple Catalog API call:
```bash
curl -X GET \
  'https://sellingpartnerapi-eu.amazon.com/catalog/2022-04-01/items/B08X6PZFN2?marketplaceIds=A1F83G8C2ARO7P' \
  -H 'x-amz-access-token: YOUR_ACCESS_TOKEN'
```

If you get `403 Forbidden` → Scope not enabled  
If you get `200 OK` → Scope is working ✅

---

## 📝 Next Steps to Enable Additional Scopes

### Step 1: Update SP-API Application in Seller Central
1. Go to: https://sellercentral.amazon.co.uk/apps/manage
2. Click on your SP-API application
3. Click "Edit App" or "Manage Permissions"
4. Enable these additional API sections:
   - ✅ Catalog Items API
   - ✅ Reports API v2021-06-30
   - ✅ Product Fees API
   - ✅ Listings Items API (optional)
5. Save changes

### Step 2: Re-authorize Application (if required)
Some scope changes may require re-authorization:

1. Run the OAuth flow again:
   ```bash
   GET /api/amazon/oauth/authorize
   ```

2. Update the scopes in the authorize endpoint:
   ```typescript
   // In: src/routes/api/amazon/oauth/authorize/+server.ts
   authUrl.searchParams.append('scope', 
     'sellingpartnerapi::notifications ' +
     'sellingpartnerapi::migration ' +
     'sellingpartnerapi::catalog ' +      // ADD
     'sellingpartnerapi::reports ' +      // ADD
     'sellingpartnerapi::fees ' +         // ADD
     'sellingpartnerapi::listings'        // ADD (optional)
   );
   ```

3. Complete the OAuth flow to get a new refresh token

4. Update `.env` with the new `AMAZON_REFRESH_TOKEN`

### Step 3: Verify New Scopes Work
Test each new API:

**Catalog API**:
```bash
curl 'https://sellingpartnerapi-eu.amazon.com/catalog/2022-04-01/items/B08X6PZFN2?marketplaceIds=A1F83G8C2ARO7P'
```

**Reports API**:
```bash
curl -X POST 'https://sellingpartnerapi-eu.amazon.com/reports/2021-06-30/reports' \
  -d '{"reportType":"GET_SALES_AND_TRAFFIC_REPORT"}'
```

**Fees API**:
```bash
curl -X POST 'https://sellingpartnerapi-eu.amazon.com/products/fees/v0/listings/YOUR_SKU/feesEstimate'
```

---

## 🔐 Security Best Practices

### Environment Variables Storage
- ✅ Never commit `.env` to git
- ✅ Use `.env.local` for local development
- ✅ Use Render/Vercel environment variables in production
- ✅ Rotate credentials every 90 days
- ✅ Use different credentials for dev/staging/prod

### Refresh Token Management
- ✅ Refresh tokens don't expire (Amazon SP-API)
- ⚠️ Store securely in environment variables
- ✅ Have a backup refresh token
- ✅ Monitor for authorization errors

### Access Token Caching
The SP-API client library should:
- Cache access tokens (valid for 1 hour)
- Auto-refresh when expired
- Handle 401 errors gracefully

---

## 📊 Current Implementation Status

### Working APIs
- ✅ Notifications API (SQS polling)
- ✅ Buy Box monitoring via notifications
- ✅ Price tracking via notifications

### Not Yet Implemented (Roadmap)
- ⚠️ Catalog Items API → Phase 2
- ⚠️ Reports API → Phase 3
- ⚠️ Product Fees API → Phase 5
- ⚠️ Listings Items API → Optional

---

## 🛠️ Quick Test Commands

### Test Current Setup
```bash
# Check what's set
node -e "console.log({
  client: !!process.env.AMAZON_CLIENT_ID,
  secret: !!process.env.AMAZON_CLIENT_SECRET,
  refresh: !!process.env.AMAZON_REFRESH_TOKEN,
  aws_key: !!process.env.AMAZON_AWS_ACCESS_KEY_ID,
  aws_secret: !!process.env.AMAZON_AWS_SECRET_ACCESS_KEY
})"
```

### Get Access Token
```javascript
// test-token.js
const response = await fetch('https://api.amazon.com/auth/o2/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: process.env.AMAZON_REFRESH_TOKEN,
    client_id: process.env.AMAZON_CLIENT_ID,
    client_secret: process.env.AMAZON_CLIENT_SECRET
  })
});

const data = await response.json();
console.log('Access Token:', data.access_token ? 'Valid ✅' : 'Invalid ❌');
```

---

## 📚 Reference Documentation

- [SP-API Developer Guide](https://developer-docs.amazon.com/sp-api/)
- [SP-API OAuth Guide](https://developer-docs.amazon.com/sp-api/docs/authorizing-selling-partner-api-applications)
- [Catalog Items API](https://developer-docs.amazon.com/sp-api/docs/catalog-items-api-v2022-04-01-reference)
- [Reports API](https://developer-docs.amazon.com/sp-api/docs/reports-api-v2021-06-30-reference)
- [Product Fees API](https://developer-docs.amazon.com/sp-api/docs/product-fees-api-v0-reference)

---

## ✅ Action Items

- [ ] Verify current scopes in Seller Central
- [ ] Enable Catalog Items API scope
- [ ] Enable Reports API scope
- [ ] Enable Product Fees API scope
- [ ] Re-authorize application if needed
- [ ] Test each API endpoint
- [ ] Update roadmap with results
- [ ] Document any issues or limitations

---

**Last Updated**: 13 October 2025  
**Next Review**: After scope verification
