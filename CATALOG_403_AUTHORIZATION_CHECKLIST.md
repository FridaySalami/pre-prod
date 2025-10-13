# Catalog API Still 403 - Authorization Checklist

**Issue**: New refresh token still returns 403 for Catalog Items API  
**Root Cause**: The authorization did NOT include "Product Listing" scope

---

## 🔍 What Happened

You generated a new refresh token, but it **still doesn't have Catalog Items API permissions**.

This happens when:
1. ❌ "Product Listing" role was not checked during authorization
2. ❌ "Product Listing" role is not enabled in your Seller Central app settings
3. ❌ The authorization URL/flow didn't include the catalog scope

---

## ✅ Verification Steps - Do This Now

### Step 1: Check if "Product Listing" is Enabled

1. Go to **Seller Central UK**: https://sellercentral.amazon.co.uk
2. Navigate to: **Settings** → **Account Info** → **Developer Central**
3. Click **"Develop Apps"**
4. Find your app (App ID: `86a5e69c4a884eab8d37ff6f28fc6ff4`)
5. Click **"Edit App"** or **"View Details"**

**Look for "Data Access" or "API Roles" section**:

```
Data Access / API Roles
========================
□ Amazon Fulfillment
□ Buyer Communication  
☑ Pricing                           ← Should be checked
☑ Inventory and Order Tracking      ← Should be checked
□ Product Listing                    ← IS THIS CHECKED? ⚠️
☑ Selling Partner Insights          ← Should be checked
□ Brand Analytics
```

**ACTION**:
- [ ] If "Product Listing" is **NOT checked** → Check it and save
- [ ] If "Product Listing" **IS checked** → Continue to Step 2

---

### Step 2: Re-Authorize with Correct Scopes

After ensuring "Product Listing" is checked, you MUST re-authorize:

**Method A: Self-Authorize in Seller Central (Easier)**

1. In your app settings page (from Step 1)
2. Look for **"Authorize"** or **"Self Authorize"** button
3. Click it
4. **VERIFY** that "Product Listing" is listed in the permissions popup
5. Confirm authorization
6. Copy the new refresh token

**Method B: OAuth URL (If no button)**

Use this URL (make sure Product Listing is enabled first!):
```
https://sellercentral.amazon.co.uk/apps/authorize/consent?application_id=amzn1.application-oa2-client.86a5e69c4a884eab8d37ff6f28fc6ff4&version=beta&state=catalog_retry_oct_2025
```

**IMPORTANT**: When you see the authorization page, **VERIFY these checkboxes are present**:
```
Grant the following permissions to this app:
☑ Product Listing         ← MUST be here!
☑ Pricing
☑ Inventory and Order Tracking
☑ Selling Partner Insights
```

If "Product Listing" is **NOT in the list**, it means:
- The role is not enabled in your app settings (go back to Step 1)
- OR your seller account doesn't have access to this API

---

### Step 3: Update .env and Test Again

After getting a NEW token with Product Listing scope:

```bash
# Update .env
nano /Users/jackweston/Projects/pre-prod/.env

# Replace AMAZON_REFRESH_TOKEN with new token
# Save and exit (Ctrl+X, Y, Enter)

# Test
cd /Users/jackweston/Projects/pre-prod
npx tsx test-catalog-fresh-token.ts
```

**Expected Result**:
```
✅ SUCCESS! Catalog API is working!
   The new token has the correct permissions.

📄 Response:
{
  "asin": "B08BPCC8WD",
  "summaries": [{
    "itemName": "Samsung QN82Q60RAFXZA...",
    "brand": "SAMSUNG"
  }]
}
```

---

## 🚨 Troubleshooting

### Issue: "Product Listing" is checked but authorization doesn't show it

**Possible causes**:
1. App configuration hasn't synced (wait 5-10 minutes)
2. Browser cache (try incognito mode)
3. Wrong app selected (verify App ID matches)

**Solution**:
```bash
# Clear browser cache and try again
# Or use a different browser
# Wait 10 minutes after enabling role
```

---

### Issue: "Product Listing" option doesn't exist in app settings

**This means**: Your seller account type doesn't support Catalog Items API

**Alternative solutions**:
1. **Use Pricing API for product names** (what bulk-scan does):
   ```javascript
   // Get title from Pricing API response
   const pricingData = await amazonAPI.getCompetitivePricing(asin);
   const title = pricingData?.Summary?.OfferListingCount > 0 
     ? pricingData.Identifier.MarketplaceASIN.Title 
     : null;
   ```

2. **Contact Amazon Seller Support**:
   - Explain you need Catalog Items API access
   - Reference your App ID: `86a5e69c4a884eab8d37ff6f28fc6ff4`
   - Ask them to enable "Product Listing" role

3. **Use alternative data sources**:
   - Amazon Product Advertising API
   - Keepa API (paid)
   - Manual product data entry

---

## 📋 Quick Diagnosis Checklist

Run through this:

- [ ] Logged into **correct Seller Central** (amazon.co.uk, not .com)
- [ ] Found the **correct app** (ID: 86a5e69c4a884eab8d37ff6f28fc6ff4)
- [ ] **"Product Listing" role is CHECKED** in app settings
- [ ] **Saved** the app settings after checking Product Listing
- [ ] **Waited 5 minutes** for role to propagate
- [ ] **Re-authorized** the app (clicked Authorize button or used OAuth URL)
- [ ] **Verified "Product Listing" appeared** in authorization popup
- [ ] **Got NEW refresh token** (different from previous one)
- [ ] **Updated .env** with the new token
- [ ] **Tested** with `npx tsx test-catalog-fresh-token.ts`
- [ ] **Result**: ✅ Success OR ❌ Still 403

---

## 💡 What to Look For in Seller Central

### When you click "Edit App", you should see something like:

```
┌─────────────────────────────────────────────┐
│ Application Details                         │
├─────────────────────────────────────────────┤
│ Name: My SP-API App                         │
│ App ID: amzn1.application-oa2-client.86... │
│                                              │
│ Data Access (Select APIs):                  │
│ ☑ Pricing                                   │
│ ☑ Inventory and Order Tracking             │
│ ☑ Selling Partner Insights                 │
│ □ Product Listing          ← CHECK THIS!   │
│ □ Brand Analytics                           │
│                                              │
│ [Save]                                      │
└─────────────────────────────────────────────┘
```

**After checking "Product Listing" and saving, click "Authorize" button:**

```
┌─────────────────────────────────────────────┐
│ Authorize Application                       │
├─────────────────────────────────────────────┤
│ Grant these permissions:                    │
│ ☑ Pricing                                   │
│ ☑ Inventory and Order Tracking             │
│ ☑ Selling Partner Insights                 │
│ ☑ Product Listing          ← MUST BE HERE! │
│                                              │
│ [Confirm Authorization]                     │
└─────────────────────────────────────────────┘
```

---

## 🎯 Next Steps

1. **Go to Seller Central NOW** and verify "Product Listing" is checked
2. If not checked → Check it, save, wait 5 minutes
3. Re-authorize the app (make sure Product Listing appears in popup)
4. Get new token and update .env
5. Test again

**If it STILL doesn't work after this**, then we need to:
- Contact Amazon Support to verify your account has Catalog API access
- OR pivot to using Pricing API for product data (workaround)

Let me know what you see in Seller Central!
