# Microsoft Graph API Setup for Excel Integration

This document explains how to set up Microsoft Graph API access for your Excel file integration.

## Step 1: Register Application in Azure AD

1. Go to the [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Fill out the form:
   - **Name**: `Pricer Tool Excel Integration`
   - **Supported account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: `Single-page application (SPA)` → `http://localhost:5173/pricer` (for development)

## Step 2: Configure API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph** > **Delegated permissions**
4. Add these permissions:
   - `Files.ReadWrite` - Read and write user files
   - `Sites.ReadWrite.All` - Read and write items in all site collections
   - `User.Read` - Sign in and read user profile

5. Click **Grant admin consent** for your organization

## Step 3: Get Configuration Values

1. Go to **Overview** in your app registration
2. Copy these values:
   - **Application (client) ID**
   - **Directory (tenant) ID**

## Step 4: Update Configuration Files

### Update `src/lib/services/microsoftGraph.ts`

Replace the placeholder values:

```typescript
const msalConfig: Configuration = {
	auth: {
		clientId: 'YOUR_CLIENT_ID_HERE', // Replace with your Application (client) ID
		authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID_HERE', // Replace with your Directory (tenant) ID
		redirectUri: window.location.origin + '/pricer'
	},
	// ... rest of config
};
```

### Update `src/lib/services/excelAPI.ts`

You'll need to find the correct values for your SharePoint file:

```typescript
const EXCEL_CONFIG = {
	siteId: 'YOUR_SHAREPOINT_SITE_ID', // This needs to be determined
	driveId: 'YOUR_DRIVE_ID', // This needs to be determined  
	fileId: '664A4DB3-2AD2-4A3F-8859-729E96C043C2', // This is from your URL
	fileName: 'Pricer - Work in progress 08.05.25.xlsx'
};
```

## Step 5: Find SharePoint Site and Drive IDs

You can use Microsoft Graph Explorer to find these IDs:

1. Go to [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
2. Sign in with your account
3. Use these queries:

### Find Site ID:
```
GET https://graph.microsoft.com/v1.0/sites/parkersfood-my.sharepoint.com
```

**Example Response:**
```json
{
  "id": "parkersfood-my.sharepoint.com,12345678-abcd-1234-abcd-123456789012,87654321-dcba-4321-dcba-210987654321",
  "displayName": "ParkersFoodService",
  ...
}
```
**Copy the full `id` value** (the long string with commas)

### Find Drive ID:
```
GET https://graph.microsoft.com/v1.0/sites/{site-id}/drives
```

**Example Response:**
```json
{
  "value": [
    {
      "id": "b!ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890",
      "driveType": "business",
      "name": "Documents",
      ...
    }
  ]
}
```
**Copy the `id` value** from the drive you want (usually the "Documents" drive)

### Find File ID (alternative method):
```
GET https://graph.microsoft.com/v1.0/sites/{site-id}/drives/{drive-id}/root/children
```

**Example Response:**
```json
{
  "value": [
    {
      "id": "01ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF",
      "name": "Pricer - Work in progress 08.05.25.xlsx",
      ...
    }
  ]
}
```
**Copy the `id` value** of your Excel file

### ✅ Using Personal OneDrive Copy:

Since you've made a copy to your personal OneDrive, you now have full ownership and Excel API access!

**New File URL:** `https://parkersfood-my.sharepoint.com/:x:/g/personal/jack_w_parkersfoodservice_co_uk/Eaox5EyfqNZKvn4AlpsTLr4BGC22RcwXGwgfPLUxKCv0bQ?e=xrDfmt`

**✅ Found Correct File ID from Graph API:** `017KX46PNKGHSEZH5I2ZFL47QAS2NRGLV6`
**✅ File Name:** `Pricer - Updated 28.06.25.xlsx`

**🎉 Benefits of Personal OneDrive Copy:**
- ✅ Full ownership = Full Excel API access
- ✅ No permission issues with worksheets/cells
- ✅ Can read and write data programmatically
- ✅ Real-time sync capabilities

**🔧 Configuration Updated:**
The Excel API service has been updated with the correct file ID from your Graph API response.

### Update Your Configuration:

Once you have these values, update `src/lib/services/excelAPI.ts`:

```typescript
const EXCEL_CONFIG = {
	// Replace with the FULL site ID from Graph Explorer (includes commas)
	siteId: 'parkersfood-my.sharepoint.com,12345678-abcd-1234-abcd-123456789012,87654321-dcba-4321-dcba-210987654321',
	
	// Replace with the drive ID from Graph Explorer
	driveId: 'b!ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890',
	
	// Replace with the file ID from Graph Explorer (or keep the one from your URL)
	fileId: '01ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF',
	
	fileName: 'Pricer - Work in progress 08.05.25.xlsx'
};
```

**Important Notes:**
- The `siteId` is the FULL string including commas (e.g., `site.com,guid1,guid2`)
- The `driveId` is the long Base64-looking string from the drives response
- The `fileId` can be either from the Graph Explorer response OR the GUID from your original SharePoint URL

## Step 6: Update Production Configuration

For production deployment, you'll need to:

1. Add your production domain to the redirect URIs in Azure AD
2. Update the `redirectUri` in the configuration
3. Ensure your users have the necessary permissions to access the SharePoint file

## Troubleshooting

### Common Issues:

1. **CORS Errors**: Make sure your redirect URI is correctly configured in Azure AD
2. **Permission Errors**: Ensure admin consent has been granted for the required permissions
3. **File Access Errors**: Check that the user has access to the SharePoint file
4. **Authentication Loops**: Clear browser cache and localStorage

### Testing Permissions:

With your personal OneDrive copy, you can test your setup using Graph Explorer:

#### Test Basic File Access:
```
GET https://graph.microsoft.com/v1.0/me/drive/items/017KX46PNKGHSEZH5I2ZFL47QAS2NRGLV6
```

#### Test Excel API Access (this should now work!):
```
GET https://graph.microsoft.com/v1.0/me/drive/items/017KX46PNKGHSEZH5I2ZFL47QAS2NRGLV6/workbook/worksheets
```

#### Test Reading Excel Data:
```
GET https://graph.microsoft.com/v1.0/me/drive/items/017KX46PNKGHSEZH5I2ZFL47QAS2NRGLV6/workbook/worksheets('Sheet1')/range(address='A1:J20')
```

## 🚀 Performance and Large Files

### Understanding Excel File Size Limits

The Microsoft Graph Excel API has practical limits for file processing:

- **File Size**: Large files (>10MB) may cause timeouts
- **Complexity**: Files with many worksheets, formulas, or formatting may be slow
- **Network**: API calls timeout after 30 seconds

**Your File**: `Pricer - Updated 28.06.25.xlsx` (12MB) appears to be at the limit.

### Common Error: 504 Gateway Timeout

If you see `504 Gateway Timeout` errors, it means:
1. ❌ File is too large/complex for Excel API
2. ❌ Even basic operations (listing worksheets) timeout
3. ❌ Graph API cannot process the file in reasonable time

### Solutions for Large Files

**✅ Option 1: Pagination (Implemented)** 
- Load data in small chunks (25-100 rows at a time)
- Navigate through pages using Previous/Next buttons
- Adjustable rows per page (25, 50, 100)
- Show page info and estimated total rows

**Option 2: Column Selection**
- Load specific columns: `A:E` (columns A through E)
- Useful for wide spreadsheets with many columns
- Focus on relevant data columns only

**Option 3: File Optimization** 
- Remove unused worksheets, rows, columns
- Simplify complex formulas and formatting
- Split large file into smaller focused files

**Option 4: Alternative Integration Methods**
- **File Viewer**: Show file metadata + link to Excel Online
- **Export/Import**: Export specific data ranges to CSV/JSON
- **Manual Upload**: Upload smaller processed data files

### Automatic Fallbacks (Implemented)

The app now includes smart error handling:

1. **Connectivity Test**: Check if Excel API works before loading data
2. **Graceful Errors**: Show helpful messages instead of crashes  
3. **File Info Display**: Show file size and modification date
4. **Fallback Suggestions**: Recommend alternative approaches

### Testing Large File Handling

Test these scenarios in Graph Explorer:

```bash
# Test pagination - Page 1 (rows 1-50)
GET /me/drive/items/017KX46PNKGHSEZH5I2ZFL47QAS2NRGLV6/workbook/worksheets('Sheet1')/range(address='A1:Z50')

# Test pagination - Page 2 (rows 51-100)  
GET /me/drive/items/017KX46PNKGHSEZH5I2ZFL47QAS2NRGLV6/workbook/worksheets('Sheet1')/range(address='A51:Z100')

# Test specific columns (all rows A-E, first 100 rows)
GET /me/drive/items/017KX46PNKGHSEZH5I2ZFL47QAS2NRGLV6/workbook/worksheets('Sheet1')/range(address='A1:E100')

# Test small sample for metadata
GET /me/drive/items/017KX46PNKGHSEZH5I2ZFL47QAS2NRGLV6/workbook/worksheets('Sheet1')/range(address='A1:J10')

# Test basic file access (should always work)
GET /me/drive/items/017KX46PNKGHSEZH5I2ZFL47QAS2NRGLV6

# Test workbook access (might timeout)
GET /me/drive/items/017KX46PNKGHSEZH5I2ZFL47QAS2NRGLV6/workbook

# Test worksheet listing (likely to timeout with large files)
GET /me/drive/items/017KX46PNKGHSEZH5I2ZFL47QAS2NRGLV6/workbook/worksheets
```

### 🎯 Recommended Testing Order

1. **Start Small**: Test `A1:J10` to verify basic Excel API access
2. **Try Pagination**: Test `A1:Z50` for first page of data
3. **Check Performance**: Gradually increase range size until you find the sweet spot
4. **Test Navigation**: Try different page ranges (`A51:Z100`, `A101:Z150`)

**Pro Tip**: If `A1:Z50` works but `worksheets` listing times out, the pagination approach will work perfectly!

## 🔧 Finding the Correct File ID

The file ID from the SharePoint URL doesn't directly work with Graph API. Use Graph Explorer to find the correct ID:

### Step 1: Test These Queries in Graph Explorer

1. **Search for the file:**
   ```
   GET https://graph.microsoft.com/v1.0/me/drive/root/search(q='Pricer')
   ```

2. **List recent files:**
   ```
   GET https://graph.microsoft.com/v1.0/me/drive/recent
   ```

3. **Browse root folder:**
   ```
   GET https://graph.microsoft.com/v1.0/me/drive/root/children
   ```

4. **Get your drive info:**
   ```
   GET https://graph.microsoft.com/v1.0/me/drive
   ```

### Step 2: Find Your File in the Response

Look for a file with name: `"Pricer - Work in progress 08.05.25.xlsx"`

The response will look like:
```json
{
  "value": [
    {
      "id": "01ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF",
      "name": "Pricer - Work in progress 08.05.25.xlsx",
      "size": 123456,
      "webUrl": "https://parkersfood-my.sharepoint.com/...",
      ...
    }
  ]
}
```

**Copy the `id` value** - this is your correct file ID!

### Step 3: Update the Configuration

Once you find the correct file ID, update it in the code:

```typescript
const EXCEL_CONFIG = {
	fileId: 'YOUR_CORRECT_FILE_ID_HERE', // Replace with ID from Graph Explorer
	fileName: 'Pricer - Work in progress 08.05.25.xlsx'
};
```

### Step 4: Test Excel API Access

With the correct file ID, test these endpoints:

```
GET https://graph.microsoft.com/v1.0/me/drive/items/YOUR_FILE_ID/workbook/worksheets
GET https://graph.microsoft.com/v1.0/me/drive/items/YOUR_FILE_ID/workbook/worksheets('Sheet1')/range(address='A1:J10')
```

## Security Considerations

- Never expose client secrets in frontend code (we're using PKCE flow instead)
- Consider implementing refresh token rotation
- Monitor API usage to stay within rate limits
- Regularly review and audit API permissions

## Rate Limits

Microsoft Graph has rate limits:
- 10,000 requests per 10 minutes per application per tenant
- 120 requests per minute per user

Plan your API calls accordingly and implement proper error handling for rate limit responses (429 status codes).
