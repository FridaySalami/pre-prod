# Generate New Amazon SP-API Refresh Token

**Issue**: Current refresh token doesn't include Catalog Items API permissions  
**Solution**: Regenerate refresh token with all current roles included  
**Time Required**: 10 minutes

---

## 🎯 Why This Is Needed

Your current `AMAZON_REFRESH_TOKEN` was generated **before** the "Product Listing" role was enabled in Seller Central.

**Evidence**:
- ✅ LWA authentication works (we get access tokens)
- ✅ Notifications API works (existing permissions)
- ❌ Catalog API returns 403 "Access Denied" (new permission not in token)

**Solution**: Generate a new refresh token that includes ALL currently enabled roles.

---

## 📋 Step-by-Step Instructions

### Step 1: Get Your Application ID

Your App ID (from .env): `amzn1.application-oa2-client.86a5e69c4a884eab8d37ff6f28fc6ff4`

---

### Step 2: Generate OAuth Authorization URL

Use this URL (customize the `state` value):

```
https://sellercentral.amazon.co.uk/apps/authorize/consent?application_id=amzn1.application-oa2-client.86a5e69c4a884eab8d37ff6f28fc6ff4&version=beta&state=regenerate_oct_2025
```

**What this does**:
- Shows you all currently enabled roles (Product Listing, Pricing, etc.)
- Asks you to authorize the app
- Generates a new authorization code that includes ALL roles

---

### Step 3: Authorize the Application

1. **Open the URL in your browser** (must be logged into Seller Central UK)
2. You'll see a page showing all enabled roles:
   - ✅ Product Listing
   - ✅ Pricing
   - ✅ Selling Partner Insights
   - ✅ Inventory and Order Tracking
   - ✅ Amazon Warehousing and Distribution
   - ✅ Brand Analytics
3. **Click "Authorize"** button
4. You'll be redirected to a URL like:
   ```
   https://sellercentral.amazon.co.uk/?state=regenerate_oct_2025&spapi_oauth_code=AUTH_CODE_HERE
   ```
5. **Copy the `spapi_oauth_code` value** from the URL

---

### Step 4: Exchange Authorization Code for Refresh Token

Run this command (replace `YOUR_AUTH_CODE` with the code from Step 3):

```bash
curl -X POST https://api.amazon.co.uk/auth/o2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=YOUR_AUTH_CODE" \
  -d "client_id=amzn1.application-oa2-client.86a5e69c4a884eab8d37ff6f28fc6ff4" \
  -d "client_secret=amzn1.oa2-cs.v1.5abfb649c31467b4049571407d65ffa55b0e0dd52ba7d8324c8801e67a90298d"
```

**Expected Response**:
```json
{
  "access_token": "Atza|...",
  "refresh_token": "Atzr|...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

**Copy the `refresh_token` value** - this is your new token!

---

### Step 5: Update .env File

1. Open `/Users/jackweston/Projects/pre-prod/.env`
2. Find the line:
   ```
   AMAZON_REFRESH_TOKEN=Atzr|IwEBIDcUHD08jQ9ZivN7UIXZspSJcWcDjwaho_DE_bGPE5ieQb6AFgAii20vDgHSEfkNlB-TB8HB5CyZXZhHi_PU6YXWV8pR3uPy77-DnENyZT00pK-GO5-p_BsR5qFiA6QiZyAQEciWRkiqZPVtXk-tfv1YfegZDGzt5RaJIcAqmkQADKrPKKMgnqkwPR2CGxXwn2uxp-fb62PgDlYmRXH-91R27kZcliY6vR6YoL-18xVFKysWbZKys155SuMNXcEf3bw-aPksrsZl2DZ8FGBxJsmjtZm4PYvb_3d3OtNUILsoJd9OILBJZh_DJMU4x0oDHtixBWdUetyYzqqYE1u-qq7m
   ```
3. **Replace with the new token** from Step 4
4. Save the file

---

### Step 6: Test the Catalog API

Run the test again:

```bash
cd /Users/jackweston/Projects/pre-prod
npx tsx test-catalog-api.ts
```

**Expected Result**: ✅ Success with product data!

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

## 🔄 Alternative: Use Seller Central UI (If Command Line Fails)

If the curl command doesn't work, you can use Seller Central:

1. Go to **Seller Central UK** → **Apps & Services** → **Develop Apps**
2. Find your app (should be named something like "Buy Box Monitor" or "SP-API App")
3. Click **"View LWA Credentials"**
4. Click **"Generate Refresh Token"** or similar button
5. You'll see the authorization URL - click it
6. Authorize the app
7. You'll get a refresh token displayed - copy it
8. Update `.env` file

---

## ⚠️ Important Notes

### Before You Start:
- ✅ Make sure all required roles are enabled in Seller Central
- ✅ You're logged into Seller Central UK (not .com)
- ✅ You have the LWA credentials handy

### After Token Generation:
- ✅ **Old refresh token becomes invalid** immediately
- ✅ Test ALL your integrations (not just Catalog API)
- ✅ Consider storing the old token as backup for 24 hours

### Security:
- 🔒 **Never share** the refresh token publicly
- 🔒 The new token has same permissions as old token PLUS Catalog API
- 🔒 Refresh tokens don't expire (but can be revoked)

---

## 🧪 Quick Verification

After updating the token, verify it works:

```bash
# Test 1: Get Access Token
curl -X POST https://api.amazon.co.uk/auth/o2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=YOUR_NEW_REFRESH_TOKEN" \
  -d "client_id=amzn1.application-oa2-client.86a5e69c4a884eab8d37ff6f28fc6ff4" \
  -d "client_secret=amzn1.oa2-cs.v1.5abfb649c31467b4049571407d65ffa55b0e0dd52ba7d8324c8801e67a90298d"

# Should return: {"access_token":"Atza|...","token_type":"bearer","expires_in":3600}
```

```bash
# Test 2: Catalog API
npx tsx test-catalog-api.ts

# Should return: Product data with title, brand, images, etc.
```

---

## 📞 Help & Troubleshooting

### Issue: "Invalid client" error
**Cause**: Wrong client_id or client_secret  
**Fix**: Double-check credentials in .env match Seller Central

### Issue: "Invalid authorization code" 
**Cause**: Auth code expired (they expire in 5 minutes)  
**Fix**: Generate a new auth code and exchange immediately

### Issue: Auth code works but still 403 on Catalog API
**Cause**: Product Listing role not enabled when auth code was generated  
**Fix**: 
1. Enable Product Listing role in Seller Central
2. Wait 5 minutes
3. Generate NEW auth code (old ones don't include new roles)

### Issue: Can't find "Generate Refresh Token" in Seller Central
**Path**: 
1. Seller Central → Settings (gear icon)
2. Account Info → Developer Central
3. Develop Apps → Your App → View LWA Credentials

---

## ✅ Success Checklist

- [ ] Generated OAuth URL with correct app_id
- [ ] Logged into Seller Central UK
- [ ] Saw all 6 roles listed when authorizing
- [ ] Clicked "Authorize" button
- [ ] Copied `spapi_oauth_code` from redirect URL
- [ ] Ran curl command within 5 minutes
- [ ] Got JSON response with `refresh_token`
- [ ] Copied new refresh token (starts with `Atzr|`)
- [ ] Updated `.env` file with new token
- [ ] Saved `.env` file
- [ ] Ran `npx tsx test-catalog-api.ts`
- [ ] Saw product data (not 403 error)

---

## 🎯 Next Steps After Success

Once Catalog API works:

1. ✅ **Test other APIs** to ensure nothing broke
2. ✅ **Commit the change** to git (but NOT the .env file!)
3. ✅ **Update production** environment variables
4. ✅ **Start Phase 2** implementation:
   - Build catalog API endpoint
   - Create database schema
   - Display product details on page

---

**Ready to proceed?** 

Copy the OAuth URL above, paste it in your browser, and follow Steps 3-6!
