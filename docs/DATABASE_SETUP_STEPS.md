# Quick Database Setup Guide - Render.com

## Visual Step-by-Step for Running the SQL File

### Method 1: Web Console (Easiest - No Installation Required)

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Open Render Dashboard                          │
│ https://dashboard.render.com                            │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ Step 2: Click on "Buybox_notifications" database       │
│ (Under PostgreSQL section)                              │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ Step 3: Click "Shell" tab at the top                   │
│ (Or "Connect" > "Launch psql")                          │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ Step 4: Wait for shell to load (shows: postgres=#)     │
│                                                          │
│ You'll see a terminal-like interface in your browser    │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ Step 5: Open the SQL file on your computer             │
│ File: render-service/sql/init-notification-worker-db.sql│
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ Step 6: Copy ALL contents (Cmd+A, Cmd+C)               │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ Step 7: Paste into Render Shell (Cmd+V)                │
│ Press Enter                                              │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ Step 8: Watch for success messages:                    │
│ ✅ CREATE TABLE worker_notifications                   │
│ ✅ CREATE TABLE current_state                          │
│ ✅ CREATE TABLE worker_failures                        │
│ ✅ CREATE INDEX ...                                     │
│ ✅ Database schema initialized successfully!           │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ Step 9: Verify tables were created:                    │
│ Type: \dt                                               │
│ Press Enter                                              │
│                                                          │
│ You should see:                                         │
│  - worker_notifications                                 │
│  - current_state                                        │
│  - worker_failures                                      │
└─────────────────────────────────────────────────────────┘
```

---

### Method 2: Local psql (If Installed)

#### Check if psql is installed:
```bash
psql --version
```

**If you see:** `psql (PostgreSQL) 14.x` or similar → You have it installed! ✅

**If you see:** `command not found: psql` → Use Method 1 above, or install:
```bash
# macOS
brew install postgresql@14

# After installation, you may need to add to PATH:
echo 'export PATH="/opt/homebrew/opt/postgresql@14/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

#### Steps to run SQL file locally:

**1. Get your connection details from Render:**
- Go to Render Dashboard > Buybox_notifications
- Click **"Connect"** tab
- Look for "PSQL Command" - it looks like:
  ```
  PGPASSWORD=mypassword123 psql -h dpg-xxxxx-a.frankfurt-postgres.render.com -U buybox_notifications_user buybox_notifications
  ```

**2. Copy that entire command and run it:**
```bash
# Paste the command from Render (example):
PGPASSWORD=mypassword123 psql -h dpg-xxxxx-a.frankfurt-postgres.render.com -U buybox_notifications_user buybox_notifications
```

**3. Once connected (you'll see `buybox_notifications=>`), run:**
```sql
\i render-service/sql/init-notification-worker-db.sql
```

**4. You should see all the CREATE TABLE statements execute**

**5. Verify:**
```sql
\dt
```

---

### Method 3: One-Command Approach (Advanced)

If you have psql installed and want to do it all at once:

```bash
# Get your connection string from Render Dashboard > Connect > External Database URL
# It looks like: postgresql://user:pass@host.render.com/dbname

# Then run:
cat render-service/sql/init-notification-worker-db.sql | \
  psql "postgresql://buybox_notifications_user:YOUR_PASSWORD@dpg-xxxx.frankfurt-postgres.render.com/buybox_notifications"
```

Replace `YOUR_PASSWORD` and the hostname with your actual values from Render.

---

## Troubleshooting

### "command not found: psql"
**Solution:** Use Method 1 (Web Console) - no installation needed!

### "permission denied for schema public"
**Solution:** Make sure you're using the connection string from Render's "Connect" tab, not creating your own. The user needs proper permissions.

### "SSL connection required"
**Solution:** Add `?sslmode=require` to your connection string:
```bash
psql "postgresql://user:pass@host.render.com/dbname?sslmode=require"
```

### "relation already exists"
**Solution:** Tables are already created! You can skip this step or drop them first:
```sql
-- Only if you want to start fresh:
DROP TABLE IF EXISTS worker_failures CASCADE;
DROP TABLE IF EXISTS current_state CASCADE;
DROP TABLE IF EXISTS worker_notifications CASCADE;
-- Then run the SQL file again
```

### "password authentication failed"
**Solution:** 
1. Go to Render Dashboard > Buybox_notifications > Info
2. Click "Reset Password" if needed
3. Use the newly generated connection string

---

## What the SQL File Does

When you run `init-notification-worker-db.sql`, it:

1. ✅ Creates 3 main tables:
   - `worker_notifications` - Stores all incoming SQS notifications
   - `current_state` - Latest state per ASIN (what the UI reads)
   - `worker_failures` - Dead letter queue for failed processing

2. ✅ Adds indexes for fast queries

3. ✅ Creates helpful views:
   - `active_alerts` - Current critical/high/warning alerts
   - `worker_health` - Worker performance metrics
   - `recent_failures` - Latest errors

4. ✅ Sets up PostgreSQL extensions (uuid-ossp, pgcrypto)

---

## Next Steps After Database Setup

Once tables are created:

1. ✅ Mark this as complete
2. 🔄 Create the worker service in Render
3. 🔄 Deploy the notification processor code
4. 🔄 Test with a notification

See `RENDER_DEPLOYMENT_GUIDE.md` for worker deployment steps.

---

## Quick Test After Setup

To verify everything works:

```sql
-- Insert a test row
INSERT INTO worker_notifications (
  message_id, 
  dedupe_hash, 
  raw_notification,
  notification_type
) VALUES (
  'test-123',
  'test-hash-456',
  '{"test": true}'::jsonb,
  'TEST'
);

-- Check it was inserted
SELECT message_id, notification_type, created_at 
FROM worker_notifications;

-- Clean up test data
DELETE FROM worker_notifications WHERE message_id = 'test-123';
```

If all those queries work, you're ready to deploy the worker! 🚀
