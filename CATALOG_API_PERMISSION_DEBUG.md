# Catalog API 403 - Permission Troubleshooting

**Date**: 13 October 2025  
**Status**: New refresh token generated, still getting 403

---

## ✅ What We've Verified

1. ✅ **Endpoint is correct**: Using `sellingpartnerapi-eu.amazon.com` (Europe)
2. ✅ **Region is correct**: `eu-west-1` matches UK marketplace
3. ✅ **New refresh token works**: Can generate LWA access tokens
4. ✅ **Authentication works**: Getting 403, not 401 (means we're authenticated)
5. ✅ **Token is being used**: Confirmed via fresh token test

## ❌ What's Still Wrong

**Catalog API returns**: 403 "Access to requested resource is denied"

This means: **The refresh token doesn't have the required permission scope**

---

## 🔍 Critical Question

**When you generated the new refresh token, which Seller Central did you use?**

### Option A: sellercentral.amazon.co.uk ✅ CORRECT
- This is the UK Seller Central
- Generates tokens for Europe region
- Should work with `sellingpartnerapi-eu.amazon.com`

### Option B: sellercentral.amazon.com ❌ WRONG
- This is the US Seller Central  
- Generates tokens for North America region
- Would only work with `sellingpartnerapi-na.amazon.com`

---

## 🎯 Next Steps

### Step 1: Verify Authorization URL Used

**The correct authorization URL should be**:
```
https://sellercentral.amazon.co.uk/apps/authorize/consent?application_id=...
```

**NOT**:
```
https://sellercentral.amazon.com/apps/authorize/consent?application_id=...
```

### Step 2: Check Which Permissions Were Selected

When you clicked "Authorize", you should have seen checkboxes for:
- [ ] Product Listing ← **MUST BE CHECKED**
- [ ] Pricing
- [ ] Selling Partner Insights
- [ ] Inventory and Order Tracking
- [ ] Amazon Warehousing and Distribution
- [ ] Brand Analytics

**Question**: Was "Product Listing" checked when you authorized?

### Step 3: Verify the App Registration

Your app might be registered in the wrong Seller Central:

1. Go to **sellercentral.amazon.co.uk** (UK)
2. Navigate to: Apps & Services → Develop Apps
3. Look for app with ID: `86a5e69c4a884eab8d37ff6f28fc6ff4`
4. Check if it exists

**If it doesn't exist in UK Seller Central**:
- Your app is registered in US Seller Central
- You need to register it in UK Seller Central
- Or use a different app that's registered in UK

---

## 🔧 Diagnostic Test

Run this to check if the token is for the wrong region:

```bash
# Test with EU endpoint (what we're using now)
curl -X GET "https://sellingpartnerapi-eu.amazon.com/catalog/2022-04-01/items/B08BPCC8WD?marketplaceIds=A1F83G8C2ARO7P" \
  -H "x-amz-access-token: YOUR_ACCESS_TOKEN_HERE" \
  -H "x-amz-date: 20251013T000000Z" \
  -H "Authorization: AWS4-HMAC-SHA256 ..."

# vs

# Test with NA endpoint
curl -X GET "https://sellingpartnerapi-na.amazon.com/catalog/2022-04-01/items/B08BPCC8WD?marketplaceIds=ATVPDKIKX0DER" \
  -H "x-amz-access-token: YOUR_ACCESS_TOKEN_HERE" \
  -H "x-amz-date: 20251013T000000Z" \
  -H "Authorization: AWS4-HMAC-SHA256 ..."
```

If NA endpoint works but EU doesn't → **Token is registered for wrong region**

---

## 🎯 Most Likely Issues

### Issue 1: Product Listing Role Not Selected During Authorization

**Symptom**: Everything else works, only Catalog API fails  
**Cause**: You authorized the app but didn't check "Product Listing"  
**Fix**: Re-authorize with "Product Listing" checked

**Steps**:
1. Go to sellercentral.amazon.co.uk
2. Apps & Services → Develop Apps → Your App
3. Click "Edit" or "View LWA Credentials"
4. Click "Authorize" or "Self Authorize"
5. **MAKE SURE "Product Listing" IS CHECKED** ✓
6. Complete authorization
7. Copy new refresh token
8. Update .env

---

### Issue 2: App Registered in Wrong Seller Central

**Symptom**: 403 on ALL APIs, not just Catalog  
**Cause**: App is in sellercentral.com (US) but you're using sellercentral.co.uk (UK) marketplace  
**Fix**: Register app in UK Seller Central

**To check**:
1. Try logging into sellercentral.amazon.com (US)
2. Look for the same app ID
3. If found there → that's the problem

**Solution**:
- Either: Use US marketplaces (A2EUQ1WTGCTBG2 instead of A1F83G8C2ARO7P)
- Or: Register a NEW app in UK Seller Central

---

### Issue 3: Catalog API Requires Additional Step

**Symptom**: Brand new app, never worked  
**Cause**: Some APIs require explicit enablement beyond role selection  
**Fix**: Contact Amazon Seller Support

**To verify**:
1. Check if Pricing API works (we know it does from bulk-scan)
2. If Pricing works but Catalog doesn't → permission-specific issue

---

## 🚨 Action Required

Please answer these questions:

1. **Which Seller Central did you use to authorize?**
   - [ ] sellercentral.amazon.co.uk (UK) ✅
   - [ ] sellercentral.amazon.com (US) ❌

2. **Was "Product Listing" checked when you authorized?**
   - [ ] Yes, it was checked ✓
   - [ ] No, it wasn't checked ✗
   - [ ] I don't remember

3. **Can you access your app in sellercentral.amazon.co.uk?**
   - [ ] Yes, I can see it
   - [ ] No, it's not there
   - [ ] Haven't checked

4. **Does your Pricing API work?** (from bulk-scan)
   - [ ] Yes, bulk-scan works fine
   - [ ] No, bulk-scan also fails
   - [ ] Haven't tested

---

## 🎯 Recommended Action

**Try this now**:

1. Go to: https://sellercentral.amazon.co.uk/apps/manage
2. Find your app or look for "Develop Apps" section
3. Click "Authorize" or "Self Authorize"
4. **CAREFULLY check that "Product Listing" role is SELECTED** ✓
5. Complete authorization
6. Copy the NEW refresh token
7. Update .env
8. Run: `npx tsx test-catalog-api-comparison.ts`

If "Product Listing" WAS checked but still fails → There's a deeper issue with Amazon's permission system that may require support contact.

---

**Let me know the answers to the 4 questions above and I can help narrow down the exact issue!**
