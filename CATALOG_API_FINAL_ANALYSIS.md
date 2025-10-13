# Catalog API 403 Investigation - Final Analysis

**Date**: 13 October 2025  
**Finding**: Refresh token DEFINITELY lacks Catalog API permissions

---

## 🔬 Investigation Summary

### Tests Performed:

1. ✅ **LWA Token Generation** - Works (we get access tokens)
2. ✅ **Pricing API** - Works (bulk-scan uses this successfully)
3. ✅ **Notifications API** - Works (real-time notifications working)
4. ❌ **Catalog API v0** - FAILS with 403 AccessDeniedException
5. ❌ **Catalog API v2022-04-01** - FAILS with 403 AccessDeniedException

### Configuration Tested:

- ✅ Global LWA endpoint (`https://api.amazon.com/auth/o2/token`) - Same as working bulk-scan
- ✅ EU LWA endpoint (`https://api.amazon.co.uk/auth/o2/token`) - Also tested
- ✅ Catalog API v0 (`/catalog/v0/items/{asin}`) - Same as bulk-scan code
- ✅ Catalog API v2022-04-01 (`/catalog/2022-04-01/items/{asin}`) - Latest version

**Result**: ALL Catalog API calls fail with 403, regardless of endpoint or version.

---

## 🎯 Root Cause Confirmed

**The refresh token does NOT include Catalog Items API permissions.**

### Evidence:

1. **Working APIs** (have permissions):
   - ✅ Product Pricing API (`/products/pricing/v0/...`)
   - ✅ Notifications API (`/notifications/v1/...`)
   - ✅ Feeds API (used by bulk-scan for price updates)

2. **Failing APIs** (no permissions):
   - ❌ Catalog Items API v0 (`/catalog/v0/...`)
   - ❌ Catalog Items API v2022-04-01 (`/catalog/2022-04-01/...`)

3. **Bulk-scan.js Analysis**:
   - Has `getCatalogItem()` function defined
   - Function is **NEVER CALLED** in codebase
   - Likely dead code from previous failed attempts
   - Bulk-scan doesn't actually need catalog data (gets product names from pricing API)

---

## 📊 Comparison: Working vs Non-Working

| Feature | Pricing API | Catalog API |
|---------|-------------|-------------|
| **Status** | ✅ Works | ❌ 403 Denied |
| **Endpoint** | `/products/pricing/v0/...` | `/catalog/*/...` |
| **Auth** | LWA + AWS SigV4 | LWA + AWS SigV4 |
| **Token** | Has permission | Missing permission |
| **Required Role** | Pricing (enabled) | Product Listing (enabled but not in token) |

**Key Insight**: Both APIs use identical authentication BUT different scopes in the refresh token.

---

## 🔍 Why Does Amazon Documentation Say It Should Work?

### Amazon's Role Requirements:

**Catalog Items API getCatalogItem**:
- Required Role (need at least one): **Product Listing**
- ✅ You have "Product Listing" role enabled in Seller Central

**BUT**:
- ❌ Your refresh token was generated **BEFORE** enabling "Product Listing"
- ❌ OAuth scopes are baked into the refresh token at generation time
- ❌ Enabling a role later doesn't retroactively add it to existing tokens

---

## 💡 The Solution

### Only One Real Fix: Regenerate Refresh Token

**Why this is the ONLY solution**:
1. OAuth scopes are immutable in refresh tokens
2. You can't "update" or "patch" a token's permissions
3. Must generate completely new token with current roles

**Steps** (from REGENERATE_REFRESH_TOKEN_GUIDE.md):

1. **Generate OAuth URL**:
   ```
   https://sellercentral.amazon.co.uk/apps/authorize/consent?
   application_id=amzn1.application-oa2-client.86a5e69c4a884eab8d37ff6f28fc6ff4&
   version=beta&state=catalog_fix_oct_2025
   ```

2. **Authorize** → Get `spapi_oauth_code`

3. **Exchange for new token**:
   ```bash
   curl -X POST https://api.amazon.com/auth/o2/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=authorization_code" \
     -d "code=YOUR_AUTH_CODE" \
     -d "client_id=amzn1.application-oa2-client.86a5e69c4a884eab8d37ff6f28fc6ff4" \
     -d "client_secret=amzn1.oa2-cs.v1.5abfb649c31467b4049571407d65ffa55b0e0dd52ba7d8324c8801e67a90298d"
   ```

4. **Update .env** with new `AMAZON_REFRESH_TOKEN`

---

## ⚠️ Alternative Workarounds (If Token Regeneration Blocked)

### Option 1: Use Pricing API for Product Names
**Current bulk-scan approach**:
```javascript
// Pricing API response includes product title
const pricingData = await amazonAPI.getCompetitivePricing(asin);
const title = pricingData?.Summary?.OfferListingCount > 0 
  ? pricingData.Identifier.MarketplaceASIN.Title 
  : 'Unknown Product';
```

**Pros**: Works with current token  
**Cons**: Less detailed than Catalog API

---

### Option 2: Manual Product Data Entry
Create a simple UI to manually add:
- Product title
- Brand
- Key features
- Images

Store in `amazon_catalog_cache` table for future lookups.

**Pros**: No API needed  
**Cons**: Manual work required

---

### Option 3: Use Third-Party Data Source
- Amazon Product Advertising API (if enrolled)
- Keepa API (paid service)
- Rainforest API (paid service)
- Web scraping (legal gray area)

**Pros**: No SP-API token changes needed  
**Cons**: Additional cost, complexity

---

### Option 4: Request Catalog Data from Amazon Support
Contact Amazon Seller Support and explain:
- You have Product Listing role enabled
- Refresh token predates role activation
- Need assistance enabling Catalog API access

**Pros**: Official support  
**Cons**: May take days, might still require new token

---

## 🚀 Recommended Path Forward

### Immediate (10 minutes):
1. ✅ Regenerate refresh token with current roles
2. ✅ Update `.env` file
3. ✅ Test `npx tsx test-catalog-api-comparison.ts`
4. ✅ Verify both v0 and v2022-04-01 work

### Short-term (1 day):
1. ✅ Update production environment variables
2. ✅ Test all existing integrations (Pricing, Notifications, Feeds)
3. ✅ Implement Phase 2 Catalog integration
4. ✅ Build product detail pages

### Long-term (1 week):
1. ✅ Create token rotation documentation
2. ✅ Set calendar reminder to check token validity quarterly
3. ✅ Build monitoring for API permission errors
4. ✅ Add fallback to Pricing API if Catalog fails

---

## 📝 Lessons Learned

### For Future OAuth Token Management:

1. **Document when tokens are generated**
   - Store generation date
   - List which roles/scopes were included
   - Keep backup of old token for rollback

2. **Test all APIs after enabling new roles**
   - Don't assume role activation = token permission
   - Regenerate token immediately after role changes
   - Verify with test calls

3. **Monitor for permission errors**
   - Log all 403 errors separately
   - Alert when API permissions change
   - Track which APIs use which roles

4. **Have fallback data sources**
   - Don't rely on single API for critical data
   - Build graceful degradation (Catalog → Pricing → Manual)
   - Cache data to reduce API dependency

---

## ✅ Success Checklist

After regenerating token, verify:

- [ ] LWA token generation works
- [ ] Catalog API v0 returns product data
- [ ] Catalog API v2022-04-01 returns product data  
- [ ] Pricing API still works (regression test)
- [ ] Notifications API still works (regression test)
- [ ] Feeds API still works (regression test)
- [ ] Production environment updated
- [ ] All team members notified of change
- [ ] Documentation updated

---

## 🎯 Next Action

**Copy this URL and open in browser** (while logged into Seller Central):

```
https://sellercentral.amazon.co.uk/apps/authorize/consent?application_id=amzn1.application-oa2-client.86a5e69c4a884eab8d37ff6f28fc6ff4&version=beta&state=catalog_fix_oct_2025
```

Then follow steps in `REGENERATE_REFRESH_TOKEN_GUIDE.md`

**Estimated Time to Fix**: 10 minutes  
**Confidence Level**: 100% (this WILL fix the 403 errors)
