# Render Deployment Configuration

## 🔧 **Service Settings**

### Basic Configuration
```
Service Name: buy-box-render-service
Environment: Node
Region: Oregon (US West) or Frankfurt (EU Central) - choose closest to your users
Branch: main
Root Directory: render-service
```

### Build Settings
```
Build Command: npm install
Start Command: node server.js
```

### Auto-Deploy
```
✅ Enable Auto-Deploy from GitHub
```

## 🔐 **Environment Variables to Add**

Copy these exact key-value pairs into Render's environment variables section:

### Supabase Configuration
```
PUBLIC_SUPABASE_URL=your_supabase_url_here
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
PRIVATE_SUPABASE_SERVICE_KEY=your_supabase_service_key_here
```

### Amazon SP-API Configuration
```
AMAZON_CLIENT_ID=your_amazon_client_id_here
AMAZON_CLIENT_SECRET=your_amazon_client_secret_here
AMAZON_REFRESH_TOKEN=your_amazon_refresh_token_here
AMAZON_REGION=eu-west-1
AMAZON_MARKETPLACE_ID=A1F83G8C2ARO7P
AMAZON_SELLER_ID=your_seller_id_here
```

### AWS Configuration
```
AMAZON_AWS_ACCESS_KEY_ID=your_aws_access_key_here
AMAZON_AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
AMAZON_AWS_REGION=eu-west-1
```

### Additional Keys (Optional - for future features)
```
LINNWORKS_APP_ID=your_linnworks_app_id_here
LINNWORKS_APP_SECRET=your_linnworks_app_secret_here
LINNWORKS_ACCESS_TOKEN=your_linnworks_token_here
OPENAI_API_KEY=your_openai_api_key_here
```

## 📋 **Deployment Checklist**

### Before Deployment
- ✅ Render service code is complete and tested locally
- ✅ Environment variables are prepared
- ✅ GitHub repository is accessible
- ✅ Supabase database is configured

### During Setup
1. ⬜ Connect GitHub repository
2. ⬜ Set root directory to `render-service`
3. ⬜ Configure build commands
4. ⬜ Add all environment variables
5. ⬜ Set auto-deploy on
6. ⬜ Deploy service

### After Deployment
1. ⬜ Test health endpoint: `https://your-service.onrender.com/health`
2. ⬜ Verify database connectivity
3. ⬜ Test bulk scan endpoint: `https://your-service.onrender.com/api/bulk-scan/test`
4. ⬜ Update Netlify functions to call Render service URL

## 🎯 **Expected Behavior**

### Successful Deployment
```
✅ Build completes successfully
✅ Service starts on assigned port
✅ Health check returns 200 OK
✅ Database connection established
✅ 3,477 Active ASINs detected
```

### Available Endpoints
```
GET  /health                    - Service health check
GET  /                         - Service information
POST /api/bulk-scan/start      - Start bulk ASIN scan
GET  /api/bulk-scan/test       - Test with sample ASINs
GET  /api/job-status/:jobId    - Get job progress
POST /api/job-status/:jobId/cancel - Cancel running job
```

## 🔍 **Troubleshooting**

### Common Issues
- **Build fails**: Check Node.js version compatibility
- **Service won't start**: Verify `start` command is `node server.js`
- **Environment variables**: Ensure all required vars are set
- **Database connection**: Verify Supabase credentials

### Logs to Check
- Build logs for npm install issues
- Service logs for runtime errors
- Health endpoint response for database connectivity

## 💰 **Render Free Tier Limits**
- 750 hours/month runtime (sufficient for Buy Box monitoring)
- No timeout limits (perfect for 2-3 hour ASIN scans)
- Automatic HTTPS
- Custom domain support
