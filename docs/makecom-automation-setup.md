# Automated Daily Metric Review Upload with Make.com

This guide shows how to set up Make.com to automatically trigger the daily metric review upload at a scheduled time, so you don't have to manually click the upload button.

## 🚀 **API Endpoint Created**

**Endpoint:** `/api/upload-metric-review`  
**Method:** `POST`  
**Purpose:** Automatically upload current week's metric data to daily_metric_review table

### API Response Examples:

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully uploaded daily metric review for week 6/16/2025 - 6/22/2025 via API",
  "weekRange": "6/16/2025 - 6/22/2025",
  "uploadedAt": "2025-06-18T14:30:00.000Z"
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Employee hours data validation failed: Data for 2025-06-08 is outside current week",
  "timestamp": "2025-06-18T14:30:00.000Z"
}
```

## 🔧 **Make.com Setup Instructions**

### Step 1: Create a New Scenario
1. Login to [Make.com](https://make.com)
2. Click "Create a new scenario"
3. Name it: "Daily Metric Review Auto Upload"

### Step 2: Add Schedule Trigger
1. Click the "+" to add a module
2. Search for and select "Schedule"
3. Choose "Schedule" (the basic scheduler)
4. Configure timing:
   - **Interval:** Once per day
   - **Time:** Set to your preferred upload time (e.g., 6:00 PM)
   - **Advanced scheduling:** Choose days (Monday-Friday for work days)
   - **Time zone:** Set to your local timezone

### Step 3: Add HTTP Request Module
1. Click "+" after the Schedule module
2. Search for and select "HTTP"
3. Choose "Make a request"
4. Configure the HTTP request:

   **URL:** `https://your-domain.com/api/upload-metric-review`  
   *(Replace `your-domain.com` with your actual domain)*

   **Method:** `POST`

   **Headers:**
   ```
   Content-Type: application/json
   ```

   **Body type:** Raw
   **Body content:**
   ```json
   {
     "weekOffset": 0
   }
   ```
   *(weekOffset: 0 = current week, -1 = previous week)*

### Step 4: Add Error Handling (Optional but Recommended)
1. Click "+" after the HTTP module
2. Add a "Filter" module
3. Set condition: `success` equals `false`
4. Add email notification or Slack message for failures

### Step 5: Test and Activate
1. Click "Run once" to test the scenario
2. Check the execution log for success/failure
3. If successful, click the toggle to "ON" to activate

## 📋 **Example Make.com Scenario Flow**

```
[Schedule: Daily 6PM] → [HTTP: POST /api/upload-metric-review] → [Filter: If Failed] → [Email: Alert]
```

## 🕐 **Recommended Schedule**

**Best Practice:** Set the upload to run after business hours when all data is available.

**Suggested Times:**
- **6:00 PM** - After work hours, ensures all daily data is captured
- **7:00 PM** - Safe buffer time for late entries
- **8:00 PM** - Conservative approach for complete data

**Days to Run:** Monday through Friday (business days only)

## 🔍 **Monitoring & Verification**

### Check Upload Success:
1. **Make.com Execution Log:** View the scenario execution history
2. **Browser Console:** Visit your app and check for upload logs
3. **Supabase Database:** Verify data in `daily_metric_review` table

### Expected API Response Times:
- **Normal:** 3-10 seconds
- **Slow:** 10-30 seconds (during high data processing)
- **Timeout:** >30 seconds (indicates an issue)

## ⚠️ **Error Scenarios & Solutions**

### Common Errors:

**1. Data Contamination Error:**
```json
{
  "error": "CONTAMINATION DETECTED: Linnworks Orders API contains data from previous week"
}
```
**Solution:** The validation is working correctly - check your data sources for stale data.

**2. API Timeout:**
```json
{
  "error": "Request timeout"
}
```
**Solution:** Increase timeout in Make.com to 60 seconds.

**3. Supabase Connection Error:**
```json
{
  "error": "Failed to upload to Supabase"
}
```
**Solution:** Check Supabase service status and API keys.

## 🔐 **Security Considerations**

- The API runs server-side with service role permissions
- No authentication required for the endpoint (consider adding API key if needed)
- All validation logic prevents data contamination
- Logs are created for audit purposes

## 📊 **What Gets Uploaded**

The API uploads the exact same data as clicking the "📊 Upload Review" button:

✅ **Current Week Data Only:**
- Scheduled Hours (from hours service)
- Employee Hours (total and role breakdown)
- Linnworks Orders (all channels)
- Financial Data (sales by channel)
- Computed Metrics (efficiency, utilization, accuracy)

✅ **Validation Applied:**
- Date range validation for all data sources
- Contamination detection and prevention
- Error throwing if any previous week data detected

## 🚀 **Next Steps**

1. **Set up the Make.com scenario** using the instructions above
2. **Test the automation** during a safe time
3. **Monitor for a few days** to ensure reliability
4. **Adjust timing** if needed based on data availability

Your daily metric uploads will now happen automatically! 🎉
