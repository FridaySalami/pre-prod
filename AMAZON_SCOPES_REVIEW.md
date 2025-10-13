# Amazon SP-API Scopes - Current Status

**Date**: 13 October 2025  
**Reviewed From**: Seller Central Developer Console Screenshot

---

## ✅ Currently Enabled API Scopes

Based on your screenshot, you have the following scopes enabled:

### 1. **Product Listing** ✅
- **Description**: Create and manage product listings, including A+ content
- **Use Case**: Managing product catalog entries
- **Roadmap Impact**: Helpful but not critical for current roadmap

### 2. **Pricing** ✅
- **Description**: Determine list prices and automate product pricing
- **Use Case**: Price management and automation
- **Roadmap Impact**: You already have this working via notifications

### 3. **Selling Partner Insights** ✅
- **Description**: View information about the Amazon Selling Partner account and performance
- **Use Case**: Account-level analytics
- **Roadmap Impact**: Useful for dashboard metrics

### 4. **Inventory and Order Tracking** ✅
- **Description**: Analyze and manage inventory. Does not include information required to generate shipping labels
- **Use Case**: Stock level monitoring
- **Roadmap Impact**: Good for inventory alerts

### 5. **Amazon Warehousing and Distribution** ✅
- **Description**: Analyze and manage AWD shipments and inventory. Generally used for interacting with AWD inventory information and shipment details
- **Use Case**: FBA/AWD management
- **Roadmap Impact**: Advanced fulfillment features

### 6. **Brand Analytics** ✅
- **Description**: Access your sales and inventory data to manage your Amazon Retail business
- **Use Case**: Sales analytics and reporting
- **Roadmap Impact**: **IMPORTANT** - This might give us some sales data!

---

## ❌ Missing Required Scopes for Roadmap

You need to enable these additional scopes for the roadmap:

### 1. **Catalog Items API** ⚠️ CRITICAL - Phase 2
**What it provides**:
- Product title, brand, manufacturer
- Product images (up to 7)
- Feature bullets & description
- Product dimensions & weight
- Category & BSR data
- Package dimensions for FBA fee calculation

**How to enable**:
1. Scroll down in the Developer Console
2. Look for "Catalog Items" or similar
3. Check the checkbox
4. Save changes

---

### 2. **Reports API** ⚠️ CRITICAL - Phase 3
**What it provides**:
- Sales & Traffic Report (revenue, units, sessions)
- Business Reports
- Settlement Reports
- FBA Reports

**This is ESSENTIAL for**:
- 30-day revenue metrics
- Unit sales data
- Conversion rates
- Traffic data

**How to enable**:
1. Look for "Reports" in the API sections
2. Enable "Reports API v2021-06-30"
3. Save changes

---

### 3. **Product Fees API** ⚠️ NEEDED - Phase 5
**What it provides**:
- FBA fee estimates per SKU/price
- Referral fee calculations
- Fee breakdowns

**This replaces the mock**:
- FBA Fee: $14.02 → Real calculation

**How to enable**:
1. Look for "Product Fees" or "Fees Estimate"
2. Enable the scope
3. Save changes

---

## 🔍 Scopes to Investigate

### Brand Analytics Scope ✅
You already have this enabled! This might provide some sales data. Let's test what's available:

**Potential endpoints**:
- Brand Analytics reports
- Market basket analysis
- Search term reports
- Inventory reports

**Action Item**: Test Brand Analytics API to see if we can get sales data without waiting for Reports API approval.

---

## 🚨 Important Notes

### Re-Authorization Required
When you enable new scopes, you may need to:
1. Re-authorize the application
2. Get a new refresh token
3. Update your `.env` file

### Testing New Scopes
After enabling new scopes:
```bash
# Test if scope is active
curl 'https://sellingpartnerapi-eu.amazon.com/catalog/2022-04-01/items/B08X6PZFN2?marketplaceIds=A1F83G8C2ARO7P' \
  -H 'x-amz-access-token: YOUR_TOKEN'
```

If you get `403 Forbidden` → Scope not enabled or not authorized  
If you get `200 OK` → Scope is working! ✅

---

## 📋 Next Steps

### Immediate Actions:
1. ✅ **Fixed TypeScript errors** in server.ts
   - Removed duplicate `shippingPrice` property
   - Added type annotations to fix `any` type errors

2. ⚠️ **Enable Missing Scopes** (In Developer Console):
   - [ ] Enable "Catalog Items API"
   - [ ] Enable "Reports API v2021-06-30"  
   - [ ] Enable "Product Fees API"

3. 🔬 **Test Brand Analytics**:
   - [ ] See what data is available
   - [ ] Check if we can get sales metrics
   - [ ] Might be a shortcut to revenue data!

4. 🔄 **Re-authorize if needed**:
   - [ ] After enabling new scopes, check if re-auth needed
   - [ ] Update refresh token if required

---

## 🎯 Optimistic Path Forward

**Good News**: You have **Brand Analytics** enabled! 

This might give us:
- Sales data by SKU/ASIN
- Inventory performance
- Market insights
- Search analytics

**Let's try this first** before waiting for Reports API approval.

---

## TypeScript Errors - FIXED ✅

Fixed these errors in `/src/routes/api/buy-box-alerts/product/[asin]/+server.ts`:

1. **Line 118**: Duplicate `shippingPrice` property ✅ FIXED
   - Removed the duplicate declaration

2. **Lines 125-127**: Missing type annotations ✅ FIXED
   - Added `(p: any)` type annotations to map/filter functions

All TypeScript errors should now be resolved!

---

## 📚 Reference

- [SP-API Scopes Documentation](https://developer-docs.amazon.com/sp-api/docs/roles-in-the-selling-partner-api)
- [Brand Analytics API](https://developer-docs.amazon.com/sp-api/docs/brand-analytics-api-v1-reference)
- [Catalog Items API](https://developer-docs.amazon.com/sp-api/docs/catalog-items-api-v2022-04-01-reference)
- [Reports API](https://developer-docs.amazon.com/sp-api/docs/reports-api-v2021-06-30-reference)

---

**Status**: TypeScript errors fixed ✅  
**Next**: Enable Catalog Items, Reports, and Fees API scopes
