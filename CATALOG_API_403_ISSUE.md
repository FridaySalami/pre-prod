# Catalog Items API 403 Error - Access Denied

**Date**: 13 October 2025  
**Issue**: Catalog Items API v2022-04-01 returns 403 Unauthorized

---

## 🔴 Problem Summary

When attempting to access the Catalog Items API, we receive:

```json
{
  "success": false,
  "errors": [
    {
      "code": "Unauthorized",
      "message": "Access to requested resource is denied.",
      "details": ""
    }
  ],
  "statusCode": 403
}
```

**Error Type**: `AccessDeniedException`  
**Endpoint Tested**: `GET /catalog/2022-04-01/items/B08BPCC8WD`  
**Marketplace**: A1F83G8C2ARO7P (UK)

---

## 📊 What We Expected

According to Amazon's documentation:

### Catalog Items API v2022-04-01 - `getCatalogItem`

| Attribute | Value |
|-----------|-------|
| **Regions** | NA, EU, FE |
| **Required roles** (need at least one) | Product Listing |

**Our Status**: ✅ We have "Product Listing" role enabled

**Expected Result**: Should work ✅  
**Actual Result**: 403 Forbidden ❌

---

## 🔍 Possible Causes

### 1. **Role Configuration Issue**
- The "Product Listing" role might need additional configuration
- The role might not be properly linked to the Catalog Items API
- Seller Central might have a separate toggle for Catalog API access

### 2. **Authorization Scope Issue**  
- The OAuth refresh token might have been generated BEFORE the Product Listing role was enabled
- Need to re-authorize the application to include Catalog API permissions
- The LWA (Login with Amazon) token might not include the catalog scope

### 3. **API Version Mismatch**
- We're using v2022-04-01 (latest version)
- Might need to check if a different version is accessible

### 4. **Restricted Access**
- Some sellers might need Amazon approval for Catalog API access
- There might be additional prerequisites (e.g., brand registry, minimum sales)

---

## ✅ What IS Working

Our credentials ARE valid because:

1. ✅ **Authentication succeeds** - We get a 403, not a 401
2. ✅ **LWA token generation works** - No auth errors
3. ✅ **AWS SigV4 signing works** - Request is properly signed
4. ✅ **Other APIs work** - Notifications API is fully functional

**This confirms**:
- Credentials are correct
- API client is working
- Issue is **permission-specific** to Catalog Items API

---

## 🛠️ Troubleshooting Steps

### Step 1: Verify Seller Central Configuration

1. Go to **Seller Central** → **Apps & Services** → **Develop Apps**
2. Click on your application (e.g., "Buy Box Monitor")
3. Check **Data Access** section:
   - Verify "Product Listing" is checked ✅
   - Look for any Catalog-specific permissions
   - Check if there's a separate "Catalog Items API" toggle

### Step 2: Re-Authorize the Application

The OAuth token might have been created before enabling Product Listing role.

**Process**:
1. In Seller Central → Apps & Services → Develop Apps
2. Click **"Edit App"** on your application
3. Click **"LWA Credentials"**
4. Generate a **NEW** OAuth Authorization Code:
   ```
   https://sellercentral.amazon.co.uk/apps/authorize/consent?
   application_id=YOUR_APP_ID&
   version=beta
   ```
5. Exchange the new authorization code for a **NEW** refresh token
6. Update `.env` with the new `AMAZON_REFRESH_TOKEN`

### Step 3: Check API Access Explicitly

1. In Seller Central → Settings → User Permissions
2. Check if there's a "Catalog Items API" permission
3. Ensure your user account has all required permissions

### Step 4: Try Alternative Endpoint

Test the older Catalog Items API v2020-12-01:

```typescript
// Try v2020-12-01 instead
const response = await client.get(
  `/catalog/2020-12-01/items/${asin}`,
  {
    queryParams: {
      MarketplaceId: 'A1F83G8C2ARO7P'
    }
  }
);
```

---

## 🎯 Immediate Action Required

### Option A: Re-Authorize (RECOMMENDED)

**Why**: Most likely the refresh token predates the Product Listing role activation

**Steps**:
1. Generate new OAuth code in Seller Central
2. Exchange for new refresh token
3. Update `.env` file
4. Re-run test

**Time**: ~10 minutes

---

### Option B: Enable Additional Permissions

**Why**: There might be hidden toggles in Seller Central

**Steps**:
1. Check ALL permission sections in Seller Central
2. Look for Catalog-specific API access
3. Enable if found
4. Wait 5-10 minutes for propagation
5. Re-run test

**Time**: ~15 minutes

---

### Option C: Contact Amazon Support

**Why**: This might require Amazon approval

**Steps**:
1. Go to Seller Central → Help → Contact Us
2. Select "Selling Partner API"
3. Ask: "Why am I getting 403 Unauthorized for Catalog Items API v2022-04-01 when I have Product Listing role enabled?"
4. Provide App ID and error details

**Time**: 1-3 business days

---

## 📋 Alternative Solutions (Until Fixed)

While we resolve the Catalog API access, we can:

### 1. Use Existing Data Sources

We already have product data in our database from notifications:

```sql
-- Extract from worker_notifications
SELECT DISTINCT
  asin,
  title,
  brand,
  product_type
FROM worker_notifications
WHERE asin = 'B08BPCC8WD';
```

### 2. Scrape from Amazon (Legal Alternatives)

- Use Amazon Product Advertising API (if enrolled)
- Use Amazon Attribution API
- Use MWS Product API (deprecated but might still work)

### 3. Manual Entry Workflow

Create a simple form to manually enter:
- Product title
- Brand
- Key features (bullets)
- Images (URLs)

Then cache in database for future use.

---

## 🔄 Re-Authorization Guide

### Complete Steps to Generate New Refresh Token

1. **In Seller Central**:
   ```
   Settings → Account Info → Developer Central → Develop Apps
   ```

2. **Edit Your App**:
   - Click on your app name
   - Go to "LWA Credentials" tab

3. **Generate OAuth URL**:
   ```
   https://sellercentral.amazon.co.uk/apps/authorize/consent?
   application_id=amzn1.sp.solution.YOUR_APP_ID&
   version=beta&
   state=YOUR_STATE_VALUE
   ```

4. **Authorize**:
   - Visit the URL in browser
   - Click "Authorize"
   - Copy the authorization code from redirect URL

5. **Exchange for Refresh Token**:
   ```bash
   curl -X POST https://api.amazon.co.uk/auth/o2/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=authorization_code" \
     -d "code=YOUR_AUTH_CODE" \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET"
   ```

6. **Update .env**:
   ```
   AMAZON_REFRESH_TOKEN=Atzr|new_refresh_token_here
   ```

7. **Test Again**:
   ```bash
   npm run test:catalog
   ```

---

## 📊 Success Criteria

Once resolved, we should see:

```json
{
  "asin": "B08BPCC8WD",
  "attributes": {
    "item_name": [...],
    "brand": [...],
    "bullet_point": [...]
  },
  "images": [...],
  "salesRanks": [...]
}
```

---

## 🚀 Impact on Roadmap

### If Catalog API Remains Blocked:

**Phase 2 Adjustments**:
- ❌ Cannot auto-fetch product details
- ✅ CAN use notification data for basic info
- ✅ CAN build manual entry workflow
- ✅ CAN proceed with keyword extraction from existing data

**Phase 3-10**: Not affected (use other APIs)

### If Catalog API Works:

**Phase 2 Timeline**:
- ✅ Full automation possible
- ✅ Rich product data available
- ✅ Listing health score accurate
- ✅ 17 hours implementation time

---

## 📝 Test Results

### Test Run: 13 October 2025 08:26:07 GMT

**Request**:
```
GET /catalog/2022-04-01/items/B08BPCC8WD?marketplaceIds=A1F83G8C2ARO7P&includedData=attributes,images,productTypes,salesRanks,dimensions
```

**Response**:
```json
{
  "statusCode": 403,
  "errors": [{
    "code": "Unauthorized",
    "message": "Access to requested resource is denied."
  }]
}
```

**Headers**:
- `x-amzn-errortype`: AccessDeniedException
- `x-amzn-requestid`: 592586e7-aaeb-4c8b-8cdc-85b421ba1fae

---

## 🎯 Next Steps

**Immediate** (Today):
1. ⏰ Re-authorize application with new OAuth flow
2. ⏰ Generate new refresh token
3. ⏰ Update `.env` file
4. ⏰ Re-run test script

**If Still Blocked** (Tomorrow):
1. Contact Amazon Seller Support
2. Check for undocumented permission requirements
3. Try alternative API versions

**Backup Plan** (This Week):
1. Use notification data for product info
2. Build manual entry UI
3. Proceed with Phase 3 (Reports API)

---

## 📞 Support Resources

- **Amazon SP-API Support**: https://developer.amazonservices.com/support
- **Seller Central Help**: Settings → Help → Contact Us → SP-API
- **Developer Forums**: https://developer-forums.amazon.com/

---

**Status**: 🔴 BLOCKED - Awaiting re-authorization  
**Owner**: Jack Weston  
**Priority**: HIGH - Blocks Phase 2 implementation
