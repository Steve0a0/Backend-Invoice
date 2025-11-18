# Deploy Backend to Render

This guide will help you deploy your Node.js Express PostgreSQL backend to Render.

## Prerequisites

1. **GitHub Account** - Your code must be in a GitHub repository
2. **Render Account** - Sign up at [render.com](https://render.com)
3. **Environment Variables Ready** - Gather all necessary API keys and secrets

## Deployment Steps

### Option 1: Deploy with Blueprint (Recommended)

This method uses your `render.yaml` file to automatically set up both the database and web service.

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin master
   ```

2. **Go to Render Dashboard**
   - Visit [dashboard.render.com](https://dashboard.render.com)
   - Click "New +" → "Blueprint"

3. **Connect Your Repository**
   - Select your GitHub repository
   - Render will detect the `render.yaml` file
   - Click "Apply"

4. **Render will automatically create:**
   - PostgreSQL Database: `freeinvoice-db`
   - Web Service: `freeinvoice-backend`
   - Auto-generate JWT_SECRET and ENCRYPTION_KEY
   - Connect the database to your backend

5. **Add Additional Environment Variables** (if needed)
   - Go to your web service → Environment
   - Add these variables if you use these services:
     - `GOOGLE_CLIENT_ID` - For Google OAuth
     - `GOOGLE_CLIENT_SECRET` - For Google OAuth
     - `STRIPE_SECRET_KEY` - For Stripe payments
     - `STRIPE_WEBHOOK_SECRET` - For Stripe webhooks
     - `EMAIL_USER` - For sending emails (Gmail, etc.)
     - `EMAIL_PASS` - Email password or app password
     - `OPENAI_API_KEY` - If using OpenAI features

6. **Wait for Deployment**
   - First deployment takes 5-10 minutes
   - Watch the logs for any errors
   - Your backend will be available at: `https://freeinvoice-backend.onrender.com`

### Option 2: Manual Deployment

If you prefer to set up services manually:

#### Step 1: Create PostgreSQL Database

1. In Render Dashboard, click "New +" → "PostgreSQL"
2. Configure:
   - **Name**: `freeinvoice-db`
   - **Database**: `freeinvoicepro`
   - **User**: `postgres` (default)
   - **Region**: Oregon (or closest to you)
   - **Plan**: Free
3. Click "Create Database"
4. **Save the connection details** - you'll need the Internal Database URL

#### Step 2: Create Web Service

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `freeinvoice-backend`
   - **Region**: Oregon (same as database)
   - **Branch**: `master`
   - **Root Directory**: Leave blank (or `backend` if in monorepo)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free

4. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=10000
   DATABASE_URL=[Copy from your PostgreSQL database's Internal URL]
   JWT_SECRET=[Generate a random 64-character string]
   ENCRYPTION_KEY=[Generate a random 32-character string]
   FRONTEND_URL=https://your-frontend-url.onrender.com
   ```

   To generate secrets in PowerShell:
   ```powershell
   # JWT_SECRET (64 characters)
   -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
   
   # ENCRYPTION_KEY (32 characters)
   -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
   ```

5. Click "Create Web Service"

## Post-Deployment

### 1. Verify Deployment

Check your logs in Render Dashboard:
- Look for: `✅ Connected to PostgreSQL`
- Look for: `🚀 Server running on port 10000`

### 2. Test Your API

```bash
# Health check
curl https://freeinvoice-backend.onrender.com/

# Test an endpoint (example)
curl https://freeinvoice-backend.onrender.com/api/user/profile
```

### 3. Seed Default Templates (Optional)

If you need to seed default invoice templates:

1. Go to your web service → Shell
2. Run: `node seeders/seedDefaultTemplates.js`

Or use the admin API endpoint if you have one set up.

### 4. Monitor Your Application

- **Logs**: Check real-time logs in Render Dashboard
- **Metrics**: Monitor CPU and memory usage
- **Health Checks**: Render automatically pings `/` to ensure uptime

## Important Notes

### Free Tier Limitations

- **Database**: 90 days retention, 1GB storage, sleeps after inactivity
- **Web Service**: Spins down after 15 minutes of inactivity
- **First request after sleep**: Takes 30-60 seconds to wake up

### Database Connection

Your `config/database.js` is already configured to handle Render's SSL requirements:
```javascript
dialectOptions: {
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
}
```

### CORS Configuration

Your `server.js` already handles CORS. Make sure `FRONTEND_URL` environment variable is set correctly.

### File Uploads

The free tier has **ephemeral storage**. Uploaded files (logos, images) will be deleted when the service restarts. Consider using:
- **Cloudinary** - Free tier for images
- **AWS S3** - For persistent file storage
- **Render Disks** - Paid add-on for persistent storage

## Troubleshooting

### Database Connection Fails

- Check DATABASE_URL is set correctly
- Ensure SSL is enabled in database config
- Verify database is in same region as web service

### Build Fails

- Check `package.json` has all required dependencies
- Ensure Node version compatibility
- Check build logs for specific errors

### Service Won't Start

- Check environment variables are set
- Review start command: `node server.js`
- Look for PORT binding issues (use `process.env.PORT`)

### 502 Bad Gateway

- Service might be starting up (wait 1-2 minutes)
- Check logs for application errors
- Verify health check path is correct

## Update Deployment

Render auto-deploys on every push to your main branch:

```bash
git add .
git commit -m "Update feature"
git push origin master
```

To disable auto-deploy:
- Go to Settings → Auto-Deploy
- Toggle off

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | Yes | Set to `10000` (Render default) |
| `DATABASE_URL` | Yes | Auto-set from database connection |
| `JWT_SECRET` | Yes | Random string for JWT tokens |
| `ENCRYPTION_KEY` | Yes | Random string for encryption |
| `FRONTEND_URL` | Yes | Your frontend URL for CORS |
| `GOOGLE_CLIENT_ID` | Optional | For Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Optional | For Google OAuth |
| `STRIPE_SECRET_KEY` | Optional | For Stripe payments |
| `STRIPE_WEBHOOK_SECRET` | Optional | For Stripe webhooks |
| `EMAIL_USER` | Optional | For sending emails |
| `EMAIL_PASS` | Optional | Email app password |
| `OPENAI_API_KEY` | Optional | For AI features |

## Next Steps

1. ✅ Deploy backend to Render
2. ✅ Test all API endpoints
3. 🔲 Deploy frontend separately
4. 🔲 Update frontend to use production API URL
5. 🔲 Set up custom domain (optional)
6. 🔲 Configure monitoring and alerts

## Support

- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com)
- [Render Status](https://status.render.com)

---

**Your Backend URL**: `https://freeinvoice-backend.onrender.com`

Remember to update this URL in your frontend configuration!
