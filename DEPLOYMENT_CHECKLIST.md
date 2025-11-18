# 🚀 Render Deployment Checklist

Use this checklist to ensure a smooth deployment.

## Pre-Deployment

- [ ] **Code is in GitHub repository**
  - Ensure latest changes are pushed
  - Branch: `master` (or your main branch)

- [ ] **Environment Variables Ready**
  - [ ] Have values for required secrets (JWT_SECRET, ENCRYPTION_KEY)
  - [ ] Google OAuth credentials (if using)
  - [ ] Stripe API keys (if using payments)
  - [ ] Email credentials (if sending emails)

- [ ] **Database Schema Ready**
  - Models defined in `/model` folder
  - Migrations ready (if any)
  - Seeders prepared (optional)

- [ ] **Files to Commit**
  - [x] `render.yaml` - Render blueprint configuration
  - [x] `package.json` - Dependencies list
  - [x] `server.js` - Entry point
  - [x] `config/database.js` - Database config with SSL
  - [ ] `.gitignore` - Ensures .env is not committed

## Deployment Steps

- [ ] **Step 1: Push to GitHub**
  ```bash
  git add .
  git commit -m "Ready for Render deployment"
  git push origin master
  ```

- [ ] **Step 2: Create Render Account**
  - Sign up at https://render.com
  - Connect your GitHub account

- [ ] **Step 3: Deploy with Blueprint**
  - Dashboard → New + → Blueprint
  - Select your repository
  - Click "Apply"

- [ ] **Step 4: Wait for Services to Create**
  - Database: `freeinvoice-db` (takes 2-3 min)
  - Web Service: `freeinvoice-backend` (takes 5-10 min)

- [ ] **Step 5: Add Optional Environment Variables**
  - Go to Web Service → Environment
  - Add any additional keys you need:
    - [ ] GOOGLE_CLIENT_ID
    - [ ] GOOGLE_CLIENT_SECRET
    - [ ] STRIPE_SECRET_KEY
    - [ ] STRIPE_WEBHOOK_SECRET
    - [ ] EMAIL_USER
    - [ ] EMAIL_PASS
    - [ ] OPENAI_API_KEY

## Post-Deployment Verification

- [ ] **Check Deployment Logs**
  - Look for: `Connected to PostgreSQL`
  - Look for: `Server running on port 10000`
  - No red error messages

- [ ] **Test Health Endpoint**
  ```bash
  curl https://freeinvoice-backend.onrender.com/
  ```

- [ ] **Test API Endpoints**
  - Try a simple GET request
  - Verify CORS headers work

- [ ] **Seed Database (if needed)**
  - Run seeders via Shell or API endpoint
  - Verify default templates are created

- [ ] **Check Database Connection**
  - Verify tables are created
  - Check data is persisting

## Configuration Updates

- [ ] **Update Frontend**
  - Change API URL to: `https://freeinvoice-backend.onrender.com`
  - Update CORS allowed origins if needed

- [ ] **Update Webhooks (if applicable)**
  - Stripe webhook URL
  - Any other webhook services

- [ ] **Custom Domain (Optional)**
  - Add custom domain in Render settings
  - Update DNS records
  - Wait for SSL certificate

## Monitoring Setup

- [ ] **Set Up Alerts**
  - Configure email notifications for downtime
  - Set up error tracking (optional: Sentry)

- [ ] **Bookmark Important Links**
  - [ ] Backend URL: https://freeinvoice-backend.onrender.com
  - [ ] Render Dashboard: https://dashboard.render.com
  - [ ] Database Dashboard: (link to your database)

## Common Issues & Solutions

### ❌ Build Fails
- Check all dependencies are in `package.json`
- Verify Node version compatibility
- Review build logs for specific errors

### ❌ Database Connection Fails
- Ensure DATABASE_URL is set correctly
- Check SSL settings in `config/database.js`
- Verify database is in same region

### ❌ Service Won't Start
- Verify PORT is set to 10000
- Check start command: `node server.js`
- Review application logs

### ❌ CORS Errors
- Verify FRONTEND_URL is set correctly
- Check allowed origins in `server.js`
- Test with curl to isolate browser issues

## Success Criteria ✅

You're successfully deployed when:
- ✅ Backend URL returns 200 OK
- ✅ Database tables are created
- ✅ API endpoints respond correctly
- ✅ Logs show no errors
- ✅ Frontend can connect to backend
- ✅ Authentication works
- ✅ File uploads work (or cloud storage configured)

## Your Deployment Info

**Backend URL**: https://freeinvoice-backend.onrender.com
**Database**: freeinvoice-db
**Region**: Oregon
**Deployment Date**: _____________

---

## Need Help?

- 📖 [Full Deployment Guide](./RENDER_DEPLOYMENT.md)
- 🔧 [Render Documentation](https://render.com/docs)
- 💬 [Render Community](https://community.render.com)
