# Deployment Guide

This guide covers deploying the Memory Capsule AI application to various hosting platforms.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Build Configuration](#build-configuration)
- [Deployment Platforms](#deployment-platforms)
  - [Vercel](#vercel)
  - [Netlify](#netlify)
  - [Firebase Hosting](#firebase-hosting)
  - [AWS Amplify](#aws-amplify)
  - [Docker](#docker)
- [Environment Configuration](#environment-configuration)
- [Post-Deployment](#post-deployment)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

1. **Firebase Project Setup**
   - Firestore Database enabled
   - Authentication (Email/Password) enabled
   - Storage enabled
   - Production security rules configured

2. **Environment Variables**
   - All required Firebase configuration values
   - (Optional) Gemini API key for AI features
   - Production-specific configuration

3. **Build Verification**
   - Application builds successfully locally
   - All tests pass
   - No TypeScript errors

---

## Build Configuration

### Environment-Specific Builds

The application supports different build modes:

```bash
# Development build
npm run build:dev

# Production build (default)
npm run build

# Preview production build locally
npm run preview
```

### Build Output

- Build output is in the `dist/` directory
- All assets are optimized and minified
- Environment variables are embedded at build time

---

## Deployment Platforms

### Vercel

Vercel provides zero-configuration deployment for Vite applications.

#### Deploy via Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   cd MeroryCapsuleAi
   vercel
   ```

4. **Set Environment Variables:**
   ```bash
   vercel env add VITE_FIREBASE_API_KEY
   vercel env add VITE_FIREBASE_AUTH_DOMAIN
   # ... add all required variables
   ```

5. **Deploy to Production:**
   ```bash
   vercel --prod
   ```

#### Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your Git repository
4. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `MeroryCapsuleAi`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Add environment variables in the "Environment Variables" section
6. Click "Deploy"

#### Vercel Configuration File

Create `vercel.json` in the `MeroryCapsuleAi` directory:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

### Netlify

Netlify offers continuous deployment from Git repositories.

#### Deploy via Netlify CLI

1. **Install Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify:**
   ```bash
   netlify login
   ```

3. **Initialize Site:**
   ```bash
   cd MeroryCapsuleAi
   netlify init
   ```

4. **Deploy:**
   ```bash
   netlify deploy --prod
   ```

#### Deploy via Netlify Dashboard

1. Go to [netlify.com](https://netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect your Git repository
4. Configure:
   - **Base directory:** `MeroryCapsuleAi`
   - **Build command:** `npm run build`
   - **Publish directory:** `MeroryCapsuleAi/dist`
5. Add environment variables in "Site settings" → "Environment variables"
6. Click "Deploy site"

#### Netlify Configuration File

Create `netlify.toml` in the `MeroryCapsuleAi` directory:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"
```

---

### Firebase Hosting

Deploy directly to Firebase Hosting alongside your Firebase backend.

#### Setup

1. **Install Firebase CLI:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase:**
   ```bash
   firebase login
   ```

3. **Initialize Firebase Hosting:**
   ```bash
   cd MeroryCapsuleAi
   firebase init hosting
   ```

   Select:
   - Use existing project (your Firebase project)
   - Public directory: `dist`
   - Configure as single-page app: Yes
   - Set up automatic builds: No (we'll build manually)

4. **Build the Application:**
   ```bash
   npm run build
   ```

5. **Deploy:**
   ```bash
   firebase deploy --only hosting
   ```

#### Firebase Configuration

Your `firebase.json` should look like:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      }
    ]
  }
}
```

#### Environment Variables

Firebase Hosting doesn't support environment variables at runtime. You must:

1. Create a `.env.production` file with production values
2. Build with production environment: `npm run build`
3. Deploy the built files

---

### AWS Amplify

AWS Amplify provides hosting with CI/CD integration.

#### Deploy via Amplify Console

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click "New app" → "Host web app"
3. Connect your Git repository
4. Configure build settings:
   - **Build command:** `npm run build`
   - **Base directory:** `MeroryCapsuleAi`
   - **Output directory:** `dist`
5. Add environment variables in "Environment variables" section
6. Click "Save and deploy"

#### Amplify Configuration File

Create `amplify.yml` in the `MeroryCapsuleAi` directory:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

---

### Docker

Deploy using Docker containers for maximum portability.

#### Dockerfile

Create `Dockerfile` in the `MeroryCapsuleAi` directory:

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### Nginx Configuration

Create `nginx.conf` in the `MeroryCapsuleAi` directory:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

#### Build and Run

```bash
# Build Docker image
docker build -t memory-capsule-ai .

# Run container
docker run -d -p 80:80 memory-capsule-ai

# Run with environment variables
docker run -d -p 80:80 \
  -e VITE_FIREBASE_API_KEY=your_key \
  -e VITE_FIREBASE_PROJECT_ID=your_project \
  memory-capsule-ai
```

**Note:** Environment variables must be set at build time for Vite applications.

#### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "80:80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

Run with: `docker-compose up -d`

---

## Environment Configuration

### Required Environment Variables

All platforms require these environment variables:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Optional: AI Features
VITE_GEMINI_API_KEY=your_gemini_api_key

# Optional: Configuration
VITE_APP_ENV=production
VITE_MAX_FILE_SIZE_MB=50
VITE_MAX_FILES_PER_CAPSULE=10
```

### Platform-Specific Setup

#### Vercel
Add variables in: Project Settings → Environment Variables

#### Netlify
Add variables in: Site Settings → Environment Variables

#### Firebase Hosting
Use `.env.production` file before building

#### AWS Amplify
Add variables in: App Settings → Environment Variables

#### Docker
Pass as `-e` flags or use `.env` file with docker-compose

---

## Post-Deployment

### 1. Verify Deployment

- [ ] Application loads without errors
- [ ] Firebase connection works
- [ ] Authentication flow works
- [ ] File uploads work
- [ ] AI features work (if enabled)
- [ ] All routes are accessible

### 2. Configure Firebase Security Rules

Update Firestore security rules for production:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Capsules - users can only access their own
    match /capsules/{capsuleId} {
      allow read, write: if request.auth != null && 
                           request.auth.uid == resource.data.user_id;
      allow create: if request.auth != null && 
                      request.auth.uid == request.resource.data.user_id;
    }
    
    // Capsule files - users can only access their own
    match /capsule_files/{fileId} {
      allow read, write: if request.auth != null && 
                           request.auth.uid == resource.data.user_id;
      allow create: if request.auth != null && 
                      request.auth.uid == request.resource.data.user_id;
    }
    
    // Shared capsules - public read if not expired
    match /shared_capsules/{shareId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
                              request.auth.uid == resource.data.user_id;
    }
    
    // Notifications - users can only access their own
    match /notifications/{notificationId} {
      allow read, write: if request.auth != null && 
                           request.auth.uid == resource.data.user_id;
    }
    
    // Users - users can only access their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && 
                           request.auth.uid == userId;
    }
  }
}
```

Update Storage security rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /capsule-files/{userId}/{capsuleId}/{fileName} {
      allow read, write: if request.auth != null && 
                           request.auth.uid == userId;
    }
  }
}
```

### 3. Set Up Monitoring

- Enable Firebase Analytics
- Set up error tracking (e.g., Sentry)
- Monitor API usage for Gemini
- Set up uptime monitoring

### 4. Configure Custom Domain (Optional)

#### Vercel
1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed

#### Netlify
1. Go to Site Settings → Domain management
2. Add custom domain
3. Configure DNS records

#### Firebase Hosting
```bash
firebase hosting:channel:deploy production --only hosting
```

### 5. Enable HTTPS

All platforms provide automatic HTTPS. Ensure:
- SSL certificate is active
- HTTP redirects to HTTPS
- Mixed content warnings are resolved

---

## Troubleshooting

### Build Fails

**Issue:** Build fails with environment variable errors

**Solution:**
- Ensure all `VITE_*` variables are set
- Check for typos in variable names
- Verify `.env.production` exists and is correct

---

### Application Loads But Features Don't Work

**Issue:** Firebase connection fails

**Solution:**
- Verify Firebase configuration values are correct
- Check Firebase project is active
- Ensure Firestore, Auth, and Storage are enabled
- Check browser console for specific errors

---

### AI Features Not Working

**Issue:** AI analysis fails or times out

**Solution:**
- Verify `VITE_GEMINI_API_KEY` is set correctly
- Check Gemini API quota in Google Cloud Console
- Ensure API key has correct permissions
- Check network connectivity to Gemini API

---

### File Uploads Fail

**Issue:** Files don't upload or download

**Solution:**
- Check Firebase Storage security rules
- Verify Storage bucket exists
- Check file size limits
- Ensure CORS is configured correctly

---

### Routing Issues (404 on Refresh)

**Issue:** Page refreshes result in 404 errors

**Solution:**
- Ensure SPA routing is configured (see platform-specific configs above)
- Verify rewrites/redirects are set up correctly
- Check that all routes redirect to `index.html`

---

### Performance Issues

**Issue:** Application loads slowly

**Solution:**
- Enable gzip compression
- Configure caching headers
- Use CDN for static assets
- Optimize images before upload
- Enable code splitting in Vite config

---

## Security Checklist

Before going to production:

- [ ] Firebase security rules are configured
- [ ] Storage security rules are configured
- [ ] HTTPS is enabled
- [ ] Environment variables are not exposed in client code
- [ ] API keys have appropriate restrictions
- [ ] CORS is configured correctly
- [ ] Content Security Policy headers are set
- [ ] Rate limiting is configured (if applicable)
- [ ] Regular security audits are scheduled

---

## Continuous Deployment

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: |
          cd MeroryCapsuleAi
          npm ci
          
      - name: Run tests
        run: |
          cd MeroryCapsuleAi
          npm test
          
      - name: Build
        run: |
          cd MeroryCapsuleAi
          npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          # ... add all environment variables
          
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: your-project-id
```

---

## Rollback Procedure

If deployment issues occur:

### Vercel
```bash
vercel rollback
```

### Netlify
Use the Netlify dashboard to rollback to a previous deployment

### Firebase Hosting
```bash
firebase hosting:clone SOURCE_SITE_ID:SOURCE_CHANNEL_ID TARGET_SITE_ID:live
```

### Docker
```bash
docker pull memory-capsule-ai:previous-tag
docker stop current-container
docker run -d memory-capsule-ai:previous-tag
```

---

## Additional Resources

- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting)
- [Vercel Documentation](https://vercel.com/docs)
- [Netlify Documentation](https://docs.netlify.com/)

---

For more information, see the [main README](../README.md) or [Environment Configuration Guide](../ENVIRONMENT.md).
