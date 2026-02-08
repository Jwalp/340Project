# 🚂 Railway Deployment Guide for FileVerse

Complete step-by-step guide to deploy your MEAN stack application to Railway.

---

## 📋 Prerequisites

- GitHub account (with your 340Project repository)
- Railway account (sign up at [railway.app](https://railway.app))
- MongoDB Atlas account (free tier at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas))

---

## Part 1: Set Up MongoDB Atlas

### 1. Create MongoDB Atlas Account
1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up for a free account
3. Click "Build a Database"
4. Choose **M0 FREE** tier
5. Select a cloud provider and region (closest to you)
6. Name your cluster (e.g., "fileverse-cluster")
7. Click "Create Cluster"

### 2. Configure Database Access
1. In Atlas dashboard, click **"Database Access"** (left sidebar)
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Create a username and **strong password** (save these!)
5. Set **"Database User Privileges"** to **"Read and write to any database"**
6. Click **"Add User"**

### 3. Configure Network Access
1. Click **"Network Access"** (left sidebar)
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (0.0.0.0/0)
   - ⚠️ This is necessary for Railway deployment
4. Click **"Confirm"**

### 4. Get Your Connection String
1. Click **"Database"** (left sidebar)
2. Click **"Connect"** on your cluster
3. Choose **"Connect your application"**
4. Select **"Node.js"** driver
5. Copy the connection string (looks like):
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<username>` and `<password>` with your actual credentials
7. Add your database name before the `?` (e.g., `/fileverse?retryWrites...`)

**Final connection string example:**
```
mongodb+srv://myuser:MyPassword123@cluster0.xxxxx.mongodb.net/fileverse?retryWrites=true&w=majority
```

---

## Part 2: Prepare Your Repository

### 1. Create Root Configuration Files

Create these files in your **project root** (same level as `backend/` and `frontend/`):

#### **`package.json`** (Root)
```json
{
  "name": "fileverse-fullstack",
  "version": "1.0.0",
  "scripts": {
    "install:backend": "cd backend && npm install",
    "install:frontend": "cd frontend && npm install",
    "install:all": "npm run install:backend && npm run install:frontend",
    "build:frontend": "cd frontend && npm run build",
    "start": "cd backend && npm start",
    "dev": "cd backend && npm run dev"
  },
  "engines": {
    "node": "18.x"
  }
}
```

#### **`railway.json`** (Root)
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run install:all && npm run build:frontend"
  },
  "deploy": {
    "startCommand": "cd backend && npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### **`.railwayignore`** (Root)
```
node_modules/
.git/
.env
*.log
frontend/node_modules/
backend/node_modules/
frontend/.angular/
```

### 2. Update Backend to Serve Frontend

Edit `backend/app.js` - **ADD THIS BEFORE THE ERROR HANDLERS** (around line 40):

```javascript
// Serve static files from Angular build (PRODUCTION)
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../frontend/dist/frontend/browser')));
  
  // All other routes return the Angular app
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api') || req.path.startsWith('/users')) {
      return next();
    }
    res.sendFile(path.join(__dirname, '../frontend/dist/frontend/browser/index.html'));
  });
}
```

### 3. Update Frontend Environment

Edit `frontend/src/environments/environment.ts`:

```typescript
export const environment = {
  production: true,
  apiUrl: '' // Empty string = use same domain as frontend
};
```

### 4. Update Frontend API Service

If you have an API service that uses `environment.apiUrl`, update it:

```typescript
// In any service that calls the backend
private apiUrl = environment.apiUrl || ''; // Use empty string if not set

// Then your API calls should be:
this.http.get(`${this.apiUrl}/api/files`)
// This will call /api/files on the same domain
```

### 5. Commit and Push Changes

```bash
git add .
git commit -m "Configure for Railway deployment"
git push origin main
```

---

## Part 3: Deploy to Railway

### 1. Create Railway Project
1. Go to [railway.app](https://railway.app)
2. Click **"Login"** → Sign in with GitHub
3. Click **"New Project"**
4. Choose **"Deploy from GitHub repo"**
5. Authorize Railway to access your repositories
6. Select your **340Project** repository
7. Click **"Deploy Now"**

### 2. Configure Environment Variables
1. Click on your deployed project
2. Click **"Variables"** tab
3. Click **"New Variable"** and add each of these:

```bash
NODE_ENV=production
PORT=3000
MONGODB_URI=your_mongodb_atlas_connection_string_here
JWT_SECRET=your_super_secure_random_string_here_make_it_long
JWT_EXPIRE=30d
FRONTEND_URL=https://your-app-name.up.railway.app

# Email Configuration (Gmail example)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password_here

# Google OAuth (if using)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://your-app-name.up.railway.app/api/auth/google/callback
```

**Important Notes:**
- Replace `your_mongodb_atlas_connection_string_here` with your actual MongoDB Atlas connection string
- Generate a secure JWT_SECRET: `openssl rand -base64 32` (run in terminal)
- Get your Railway URL from the "Settings" tab (it will be something like `fileverse-production.up.railway.app`)
- For `EMAIL_PASSWORD`, use a Gmail App Password (see below)
- Update `FRONTEND_URL` and `GOOGLE_CALLBACK_URL` with your actual Railway domain

### 3. Generate Gmail App Password
1. Go to your Google Account settings
2. Security → 2-Step Verification (enable if not already)
3. Search for "App Passwords"
4. Generate a new app password for "Mail"
5. Copy the 16-character password (no spaces)
6. Use this as your `EMAIL_PASSWORD` in Railway

### 4. Get Your Railway Domain
1. In Railway project, click **"Settings"** tab
2. Scroll to **"Domains"** section
3. Click **"Generate Domain"**
4. Copy the generated domain (e.g., `fileverse-production.up.railway.app`)
5. Update these environment variables with your domain:
   - `FRONTEND_URL=https://fileverse-production.up.railway.app`
   - `GOOGLE_CALLBACK_URL=https://fileverse-production.up.railway.app/api/auth/google/callback`

### 5. Trigger Deployment
1. Click **"Deployments"** tab
2. Railway will automatically build and deploy
3. Watch the build logs for any errors
4. Wait for status to show **"Success"** (usually 3-5 minutes)

---

## Part 4: Update Google OAuth (if using)

### 1. Update Authorized Redirect URIs
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Go to "Credentials"
4. Click on your OAuth 2.0 Client ID
5. Under "Authorized redirect URIs", add:
   ```
   https://your-railway-domain.up.railway.app/api/auth/google/callback
   ```
6. Click "Save"

---

## Part 5: Verify Deployment

### 1. Check Your Application
1. Visit your Railway domain in a browser
2. Test user registration
3. Check email verification
4. Test file upload
5. Test file conversion (if FFmpeg is needed, see note below)

### 2. Monitor Logs
1. In Railway dashboard, click **"Deployments"**
2. Click on the latest deployment
3. View logs for any errors
4. Common issues:
   - MongoDB connection errors → Check MONGODB_URI
   - Email errors → Check EMAIL_USER and EMAIL_PASSWORD
   - 404 errors → Check frontend build

---

## ⚠️ Important Notes

### FFmpeg for Media Conversion
Railway doesn't include FFmpeg by default. To enable media conversion:

1. Create `nixpacks.toml` in project root:
```toml
[phases.setup]
nixPkgs = ["nodejs-18_x", "ffmpeg"]
```

2. Commit and push:
```bash
git add nixpacks.toml
git commit -m "Add FFmpeg support"
git push origin main
```

Railway will automatically redeploy with FFmpeg support.

### File Storage Limitations
- Railway has **ephemeral storage** - files are deleted on each deployment
- Your current GridFS setup will work, but files stored on the filesystem won't persist
- Consider using a cloud storage service for uploaded files:
  - AWS S3
  - Cloudinary
  - DigitalOcean Spaces

### CORS Configuration
Your backend already has CORS configured. Update `backend/app.js` CORS origins to include your Railway domain:

```javascript
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:4200'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

---

## 🐛 Troubleshooting

### Build Fails
- Check build logs in Railway
- Ensure all dependencies are in `package.json`
- Verify Node.js version in root `package.json`

### Application Won't Start
- Check environment variables are set correctly
- Verify MongoDB connection string
- Check logs for specific errors

### 404 Errors on Frontend Routes
- Ensure frontend is built correctly
- Check that `app.js` serves Angular static files
- Verify frontend environment.ts has correct apiUrl

### Email Not Sending
- Verify Gmail App Password (not regular password)
- Check 2FA is enabled on Google account
- Verify EMAIL_USER and EMAIL_PASSWORD in Railway

### MongoDB Connection Errors
- Verify MongoDB Atlas allows Railway IP (0.0.0.0/0)
- Check connection string format
- Ensure database user has correct permissions

---

## 📊 Monitoring & Logs

### View Application Logs
```bash
# In Railway dashboard:
1. Click on your project
2. Click "Deployments"
3. Click on active deployment
4. View real-time logs
```

### Check Database Connection
```bash
# Look for this in logs:
MongoDB Connected: cluster0.xxxxx.mongodb.net
Database: fileverse
```

### Monitor Resource Usage
- Railway dashboard shows CPU, Memory, Network usage
- Free tier includes 500 hours/month
- Monitor costs in "Usage" tab

---

## 🎉 Success Checklist

- [ ] MongoDB Atlas cluster created and configured
- [ ] Repository updated with root config files
- [ ] Railway project created from GitHub
- [ ] All environment variables set
- [ ] Domain generated
- [ ] Application successfully deployed
- [ ] Frontend loads correctly
- [ ] User registration works
- [ ] Email verification works
- [ ] File upload works
- [ ] Google OAuth works (if using)

---

## 🚀 Next Steps

1. **Custom Domain**: Add your own domain in Railway Settings → Domains
2. **Monitoring**: Set up error monitoring (Sentry, LogRocket)
3. **Backups**: Set up MongoDB Atlas automated backups
4. **CI/CD**: Automatic deployment on git push (Railway does this by default!)
5. **Security**: Review and secure environment variables

---

## 💡 Tips

- Railway auto-deploys on every push to main branch
- Use Railway CLI for local development: `npm install -g @railway/cli`
- Free tier resets monthly - monitor usage
- Enable "Sleep on Idle" in Railway settings to save hours (app wakes on request)
- Check Railway status page if deployment issues: [status.railway.app](https://status.railway.app)

---

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com)
- [Angular Deployment Guide](https://angular.dev/tools/cli/deployment)
- [Express Production Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)

---

**Need Help?**
- Railway Community: [Discord](https://discord.gg/railway)
- Check deployment logs for specific errors
- Verify all environment variables are correct

**Good luck with your deployment! 🚀**
