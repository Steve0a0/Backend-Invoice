# Quick Start Guide

## Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Create a `.env` file in the backend folder:
```env
NODE_ENV=development
PORT=5000

# Local Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=freeinvoicepro
DB_USER=postgres
DB_PASS=your_password

# Secrets (generate random strings)
JWT_SECRET=your_random_64_character_string
ENCRYPTION_KEY=your_random_32_character_string

# CORS
FRONTEND_URL=http://localhost:5173

# Optional: Add other keys as needed
```

### 3. Set Up PostgreSQL Database
Make sure PostgreSQL is installed and running:
```bash
# Create database
createdb freeinvoicepro

# Or using psql
psql -U postgres
CREATE DATABASE freeinvoicepro;
\q
```

### 4. Start the Server
```bash
npm start
```

Server should start on http://localhost:5000

### 5. Test the API
```bash
# Health check
curl http://localhost:5000/

# Should return:
# {"status":"ok","message":"Freelance Invoice Backend API is running","timestamp":"..."}
```

## Deploy to Render

See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for step-by-step deployment instructions.

Quick deploy:
1. Push code to GitHub
2. Go to Render Dashboard → New + → Blueprint
3. Select your repo
4. Click "Apply"

Your backend will be live at: `https://freeinvoice-backend.onrender.com`

## Available Scripts

- `npm start` - Start the server
- `npm test` - Run tests (not configured yet)

## API Endpoints

- `GET /` - Health check
- `GET /health` - Detailed health status
- `POST /api/user/register` - User registration
- `POST /api/user/login` - User login
- `GET /api/invoices` - Get all invoices
- `POST /api/invoices` - Create invoice
- And many more...

## Seeding Default Templates

After deployment or local setup:
```bash
node seeders/seedDefaultTemplates.js
```

## Troubleshooting

### Port Already in Use
```bash
# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force
```

### Database Connection Failed
- Check PostgreSQL is running
- Verify credentials in .env
- Check database exists

### Module Not Found
```bash
npm install
```

## Need Help?

- [Full Deployment Guide](./RENDER_DEPLOYMENT.md)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
