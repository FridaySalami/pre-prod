# Alternative: Regenerate Refresh Token via Seller Central UI

**Easier method - No command line needed!**

---

## 🎯 Simplified Token Regeneration (Seller Central UI)

Instead of using OAuth URLs and curl commands, you can regenerate the token directly in Seller Central.

### Step-by-Step (5 minutes):

1. **Go to Seller Central UK**:
   ```
   https://sellercentral.amazon.co.uk
   ```

2. **Navigate to Developer Central**:
   - Click **Settings** (gear icon, top right)
   - Select **Account Info**
   - Click **Developer Central** (or search for "Developer Central")

3. **Find Your Application**:
   - Click **"Develop Apps"** tab
   - Look for your app (it might be named something like "Buy Box Monitor", "SP-API App", or "My Application")
   - Your App ID is: `amzn1.application-oa2-client.86a5e69c4a884eab8d37ff6f28fc6ff4`

4. **View LWA Credentials**:
   - Click on your application name
   - Click **"View LWA Credentials"** or **"LWA Credentials"** tab
   - You'll see:
     - Client ID (already have this)
     - Client Secret (already have this)
     - **"Authorize" button** or **"Self Authorize"** button

5. **Generate New Refresh Token**:
   - Click the **"Authorize"** button (might say "Self Authorize" or "Generate Token")
   - This will:
     - Show you all enabled roles/permissions
     - Ask you to confirm authorization
     - Generate a new refresh token
   - **Copy the new refresh token** (starts with `Atzr|`)

6. **Update Your .env File**:
   ```bash
   # Open .env file
   nano /Users/jackweston/Projects/pre-prod/.env
   
   # Find this line:
   AMAZON_REFRESH_TOKEN=Atzr|IwEBIDcUHD08jQ9ZivN7...
   
   # Replace with new token:
   AMAZON_REFRESH_TOKEN=Atzr|YOUR_NEW_TOKEN_HERE
   
   # Save and exit (Ctrl+X, then Y, then Enter)
   ```

7. **Test**:
   ```bash
   cd /Users/jackweston/Projects/pre-prod
   npx tsx test-catalog-api-comparison.ts
   ```

---

## 🔍 What to Look For

### In Seller Central:

**If you see "Authorize" or "Self Authorize" button**:
- ✅ This will generate a new token immediately
- ✅ No OAuth URL or curl commands needed
- ✅ Takes 2 minutes

**If you DON'T see an "Authorize" button**:
- You'll need to use the OAuth flow (original method)
- Follow `REGENERATE_REFRESH_TOKEN_GUIDE.md`

---

## 🚨 Common Issues

### Issue 1: Can't find "Developer Central"
**Solution**: 
- Try direct URL: `https://sellercentral.amazon.co.uk/apps/manage`
- Or search for "Apps & Services" in Seller Central search bar

### Issue 2: Can't find your app
**Solution**:
- Your app ID is `86a5e69c4a884eab8d37ff6f28fc6ff4`
- Look for any app with this ID in the list
- If not found, you may need to create a new app

### Issue 3: "Authorize" button shows error
**Solution**:
- Make sure all roles are enabled:
  - ✅ Product Listing
  - ✅ Pricing
  - ✅ Selling Partner Insights
  - ✅ Inventory and Order Tracking
- Wait 5 minutes and try again (role propagation delay)

---

## 📸 Visual Guide

Look for screens that look like this:

### Screen 1: Develop Apps
```
┌─────────────────────────────────────┐
│ Develop Apps                        │
├─────────────────────────────────────┤
│ App Name          App ID      Edit  │
│ My SP-API App     86a5e...    Edit  │ ← Click Edit
└─────────────────────────────────────┘
```

### Screen 2: App Details
```
┌─────────────────────────────────────┐
│ Application Name: My SP-API App     │
├─────────────────────────────────────┤
│ Client ID: amzn1.application-oa2... │
│ Client Secret: [hidden]             │
│                                      │
│ [View LWA Credentials]              │ ← Click this
└─────────────────────────────────────┘
```

### Screen 3: LWA Credentials
```
┌─────────────────────────────────────┐
│ LWA Credentials                      │
├─────────────────────────────────────┤
│ Client ID: amzn1.application-oa2... │
│ Client Secret: [hidden]              │
│                                      │
│ Data Access:                         │
│ ✅ Product Listing                   │
│ ✅ Pricing                            │
│ ✅ Selling Partner Insights          │
│ ✅ Inventory and Order Tracking      │
│                                      │
│ [Authorize] or [Self Authorize]     │ ← Click this!
└─────────────────────────────────────┘
```

### Screen 4: Authorization Confirmation
```
┌─────────────────────────────────────┐
│ Authorize Application               │
├─────────────────────────────────────┤
│ Grant access to:                    │
│ ✅ Product Listing                   │
│ ✅ Pricing                            │
│ ✅ Selling Partner Insights          │
│ ✅ Inventory and Order Tracking      │
│                                      │
│ [Confirm] [Cancel]                  │ ← Click Confirm
└─────────────────────────────────────┘
```

### Screen 5: Token Generated
```
┌─────────────────────────────────────┐
│ Success!                            │
├─────────────────────────────────────┤
│ Refresh Token:                      │
│ Atzr|IwEBINewTokenHere...           │
│ [Copy]                              │ ← Copy this!
│                                      │
│ Note: Store this token securely.    │
│ You won't be able to see it again.  │
└─────────────────────────────────────┘
```

---

## ✅ Quick Checklist

- [ ] Logged into Seller Central UK
- [ ] Found Developer Central / Apps & Services
- [ ] Located your app (ID: 86a5e69c4a884eab8d37ff6f28fc6ff4)
- [ ] Clicked "View LWA Credentials" or "Edit"
- [ ] Verified all roles are enabled
- [ ] Clicked "Authorize" or "Self Authorize"
- [ ] Copied new refresh token
- [ ] Updated `.env` file
- [ ] Tested with `npx tsx test-catalog-api-comparison.ts`
- [ ] Verified Catalog API returns product data (not 403)

---

## 🎯 Expected Result After Update

When you run the test, you should see:

```bash
✅ SUCCESS! v0 API is accessible!

📄 v0 API Response:
{
  "AttributeSets": [{
    "Title": "Samsung QN82Q60RAFXZA Flat 82-Inch QLED...",
    "Brand": "SAMSUNG",
    ...
  }]
}

✅ SUCCESS! v2022-04-01 API is accessible!

📄 v2022-04-01 API Response:
{
  "asin": "B08BPCC8WD",
  "summaries": [{
    "itemName": "Samsung QN82Q60RAFXZA...",
    "brand": "SAMSUNG",
    ...
  }]
}
```

**NOT** 403 errors!

---

## 🆘 If UI Method Doesn't Work

Fall back to OAuth URL method in `REGENERATE_REFRESH_TOKEN_GUIDE.md`:

```
https://sellercentral.amazon.co.uk/apps/authorize/consent?application_id=amzn1.application-oa2-client.86a5e69c4a884eab8d37ff6f28fc6ff4&version=beta&state=catalog_fix_oct_2025
```

This will definitely work but requires command line.

---

**Try the UI method first - it's much easier!** 🚀
