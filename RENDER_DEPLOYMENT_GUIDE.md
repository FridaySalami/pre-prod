# Render.com Worker Deployment - Quick Reference

## Database Setup (Buybox_notifications)

### 1. Initialize Schema

**Option A: Using Render.com Web Console (Easiest)**

1. Go to your Render Dashboard > Buybox_notifications database
2. Click the **"Shell"** tab (or "Connect" > "PSQL Command")
3. This opens a psql terminal directly in your browser
4. Copy and paste the entire contents of `render-service/sql/init-notification-worker-db.sql`
5. Press Enter to execute

**Option B: Using psql from your local machine**

First, get your connection string from Render dashboard:
- Go to Buybox_notifications database > Info tab
- Copy the "External Database URL" (starts with `postgresql://`)

Then run:
```bash
# Method 1: Pipe the SQL file
cat render-service/sql/init-notification-worker-db.sql | \
  psql postgresql://buybox_notifications_user:xxx@xxx.render.com/buybox_notifications

# Method 2: Use -f flag (if psql is installed locally)
psql postgresql://buybox_notifications_user:xxx@xxx.render.com/buybox_notifications \
  -f render-service/sql/init-notification-worker-db.sql

# Method 3: Execute directly with -c
psql postgresql://buybox_notifications_user:xxx@xxx.render.com/buybox_notifications \
  -c "$(cat render-service/sql/init-notification-worker-db.sql)"
```

**Option C: Using Render CLI (Easiest with psql installed)**

If you have the Render CLI installed:
```bash
# Install Render CLI (one time setup)
brew tap render-oss/render && brew install render

# Login to Render (one time setup)
render login
# This opens a browser - authorize the CLI

# Connect to your database (replace with your database ID)
render psql dpg-d3gdjlb3fgac738tk6c0-a

# Once connected, run:
\i render-service/sql/init-notification-worker-db.sql
```

**Option D: Using Render's manual psql command**

Render provides a pre-configured connection command:
1. Go to Buybox_notifications database > Connect tab
2. Copy the **"PSQL Command"** (includes all connection details)
3. Run it in your terminal:
```bash
# This command is provided by Render and includes authentication
PGPASSWORD=xxx psql -h xxx.render.com -U buybox_notifications_user buybox_notifications

# Once connected, run:
\i render-service/sql/init-notification-worker-db.sql
```

**Note:** If you get "command not found: psql", install PostgreSQL client:
```bash
# macOS
brew install postgresql@14

# Add to PATH
echo 'export PATH="/opt/homebrew/opt/postgresql@14/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# The SQL file will still work - just use Option A (web console) instead
```

### 2. Verify Tables Created
```sql
-- In the Render Shell or psql connection, run:

-- Check tables exist
\dt

-- Should see:
-- worker_notifications
-- current_state  
-- worker_failures

-- Check views
\dv

-- Should see:
-- active_alerts
-- worker_health
-- recent_failures

-- Verify extensions
\dx

-- Should see:
-- uuid-ossp
-- pgcrypto

-- Test a query
SELECT COUNT(*) FROM worker_notifications;
-- Should return 0 (no rows yet)
```

**If you see "permission denied" errors:**
- Make sure you're connected as the database owner
- Check Render dashboard > Database > Info for correct username
- Use the "PSQL Command" from Render's Connect tab (it has correct permissions)

## Worker Service Setup

### 1. Create New Service on Render.com

**Dashboard > New > Worker**

| Setting | Value |
|---------|-------|
| Name | `notification-processor` |
| Environment | Node |
| Region | Same as your database (e.g., Frankfurt) |
| Branch | `main` |
| Root Directory | `/` |
| Build Command | `cd workers && npm ci` |
| Start Command | `cd workers && node notification-processor/index.js` |

### 2. Link Database

In the worker service settings:
- Click **Environment** tab
- Scroll to **Add Database**
- Select your `Buybox_notifications` database
- Render will auto-add `DATABASE_URL`

### 3. Add Environment Variables

Click **Environment** > **Add Environment Variable**:

```bash
# Database (auto-populated when you link database above)
DATABASE_URL=postgresql://...  # Auto-added by Render

# If using Supabase instead of Render PostgreSQL:
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx...

# AWS SQS Configuration
SQS_QUEUE_URL=https://sqs.eu-west-1.amazonaws.com/881471314805/buybox-notifications
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=your-secret-key

# Amazon Seller Configuration  
AMAZON_SELLER_ID=A2D8NG39VURSL3

# Worker Configuration
WORKER_ID=notification-processor-1
NODE_ENV=production
VISIBILITY_TIMEOUT=120
MAX_RECEIVE_COUNT=3
POLL_INTERVAL=1000
BATCH_SIZE=10
```

### 4. Health Check Configuration

Render workers support health checks via a lightweight HTTP server:

| Setting | Value |
|---------|-------|
| Health Check Path | `/health` |
| Health Check Port | `3000` |

The worker code includes a health server on port 3000 that responds to `/health`.

### 5. Deploy

Click **Create Worker** or **Manual Deploy**.

Render will:
1. Clone your repo
2. Run `cd workers && npm ci`
3. Start `node notification-processor/index.js`
4. Monitor health via `/health` endpoint

## Monitoring Your Worker

### View Logs
**Render Dashboard > notification-processor > Logs**

You should see:
```
🚀 Starting Notification Processor Worker
✅ Database connected
🏥 Health server started on port 3000
🔄 Starting SQS polling
```

### Check Health
```bash
# Render provides a URL for health checks
curl https://notification-processor-xxx.onrender.com/health

# Should return:
{
  "status": "healthy",
  "workerId": "notification-processor-1",
  "queueConnected": true,
  "dbConnected": true,
  "uptime": 123.45
}
```

### Monitor Database

Connect to your database and run:

```sql
-- Worker activity (last hour)
SELECT * FROM worker_health;

-- Latest alerts
SELECT * FROM active_alerts LIMIT 10;

-- Recent failures
SELECT * FROM recent_failures LIMIT 10;

-- Message processing stats
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  MAX(created_at) as latest_message
FROM worker_notifications
WHERE created_at > NOW() - INTERVAL '1 hour';
```

## Testing Your Deployment

### 1. Send Test Notification

From your local machine:
```bash
node test-notifications.cjs
```

### 2. Verify Processing

Check database within ~60 seconds:
```sql
-- Should see new notification
SELECT 
  asin,
  notification_type,
  severity,
  status,
  created_at
FROM worker_notifications
ORDER BY created_at DESC
LIMIT 5;

-- Should see updated current_state
SELECT 
  asin,
  severity,
  your_price,
  market_low,
  total_offers,
  last_updated
FROM current_state
ORDER BY last_updated DESC
LIMIT 5;
```

### 3. Check Worker Logs

In Render dashboard, you should see:
```
📨 Processing message
✅ Message processed successfully
🗑️ Deleted 1 messages from queue
```

## Troubleshooting

### Worker Not Starting

**Check Logs for:**
```
❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY required
```
**Fix:** Add missing environment variables

### No Messages Being Processed

**Check:**
1. SQS queue has messages: `aws sqs get-queue-attributes --queue-url ...`
2. AWS credentials are correct
3. Worker logs show polling: `🔄 Starting SQS polling`

**Test SQS connection locally:**
```bash
node -e "
const AWS = require('aws-sdk');
const sqs = new AWS.SQS({
  region: 'eu-west-1',
  accessKeyId: 'xxx',
  secretAccessKey: 'xxx'
});
sqs.getQueueAttributes({
  QueueUrl: 'https://sqs.eu-west-1.amazonaws.com/881471314805/buybox-notifications',
  AttributeNames: ['All']
}).promise().then(console.log);
"
```

### Database Connection Errors

**Check Logs for:**
```
❌ Database connected failed
```

**Verify:**
1. Database URL is correct
2. Database is in same region (lower latency)
3. Render database is running (check dashboard)

**Test connection:**
```bash
psql $DATABASE_URL -c "SELECT NOW();"
```

### Duplicate Processing

**Check for:**
```sql
SELECT dedupe_hash, COUNT(*) 
FROM worker_notifications 
GROUP BY dedupe_hash 
HAVING COUNT(*) > 1;
```

Should return **0 rows** (unique constraint prevents duplicates).

If you see duplicates with different `message_id`, this is normal - it means AWS re-drove the message but we caught it with `dedupe_hash`.

### High Failure Rate

**Check DLQ table:**
```sql
SELECT 
  error_type,
  COUNT(*) as count,
  MAX(last_failed_at) as latest_failure
FROM worker_failures
GROUP BY error_type
ORDER BY count DESC;
```

**Common errors:**
- `ValidationError`: Notification format changed - update parser
- `NetworkError`: Database timeout - increase connection pool
- `SyntaxError`: JSON parsing failed - check notification structure

## Scaling

### Auto-Scaling (Future)

When message volume increases, you can:

1. **Horizontal Scaling**: Add more worker instances
   - Render Dashboard > notification-processor > Settings
   - Change instance count from 1 to 2-5
   - SQS will distribute messages across workers

2. **Vertical Scaling**: Upgrade instance size
   - If processing is CPU-bound
   - Render Dashboard > Settings > Instance Type

### Current Configuration

- **1 worker instance** = ~600-1000 messages/hour
- **Visibility timeout 120s** = prevents duplicate processing
- **Batch size 10** = optimal for low-medium volume

## Success Checklist

After deployment, verify:

- [ ] Worker shows "Live" status in Render dashboard
- [ ] Health endpoint returns `{"status": "healthy"}`
- [ ] Logs show successful SQS polling
- [ ] Test notification appears in database within 60s
- [ ] `current_state` table updates correctly
- [ ] No errors in `worker_failures` table
- [ ] Worker survives for 24 hours without restart

## Cost Estimate

**Render.com Pricing (as of 2025):**
- Worker (Starter): **$7/month**
- PostgreSQL (Starter 1GB): **$7/month** (you already have this)
- **Total: $7/month additional** for the worker

**Included:**
- 24/7 uptime
- Automatic restarts on failure
- Logs retention (7 days)
- Health monitoring
- SSL/TLS

## Next Steps

Once this is running smoothly for a week:

1. **Monitor metrics** - How many notifications/hour? What's P99 latency?
2. **Tune configuration** - Adjust batch size, poll interval based on actual load
3. **Expand architecture** - Add Workers 2-4 from your comprehensive plan
4. **Add alerting** - Set up notifications if worker goes down

## Quick Commands

```bash
# Render CLI (after running 'render login')
render psql dpg-d3gdjlb3fgac738tk6c0-a  # Connect to database
render logs notification-processor --tail 100  # View worker logs
render services list  # List all your services
render deploys list notification-processor  # View deploy history

# Direct psql (using connection string from Render dashboard)
psql $DATABASE_URL -c "SELECT * FROM worker_health;"

# Testing
node test-notifications.cjs  # Send test notification to SQS
```

---

**You're ready to deploy!** 🚀

Follow these steps and you'll have 24/7 notification monitoring running in under an hour.
