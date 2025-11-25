# Environment Configuration Guide

This document provides detailed information about environment variables used in the Memory Capsule AI application.

## Overview

The application uses environment variables to configure Firebase, AI services, and application settings. All environment variables must be prefixed with `VITE_` to be accessible in the Vite-based application.

## Required Variables

These variables **must** be set for the application to run:

### Firebase Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_FIREBASE_API_KEY` | Firebase API key | `AIzaSyA...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase authentication domain | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | `your-project-id` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | `your-project.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | `123456789` |
| `VITE_FIREBASE_APP_ID` | Firebase app ID | `1:123456789:web:abc123` |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase measurement ID (Analytics) | `G-XXXXXXXXXX` |

**Where to find these values:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings (gear icon) > General
4. Scroll down to "Your apps" section
5. Select your web app or create one
6. Copy the configuration values

## Optional Variables

These variables have default values and can be customized:

### AI Service Configuration

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `VITE_GEMINI_API_KEY` | Google Gemini API key | `""` (empty) | AI features disabled if not set |
| `VITE_AI_TIMEOUT_MS` | AI request timeout in milliseconds | `30000` | 30 seconds |

**Getting a Gemini API key:**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated key

### Application Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_APP_NAME` | Application display name | `Memory Capsule AI` |
| `VITE_APP_ENV` | Environment name | `development` |

### File Upload Configuration

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `VITE_MAX_FILE_SIZE_MB` | Maximum file size in MB | `50` | Per file limit |
| `VITE_MAX_FILES_PER_CAPSULE` | Maximum files per capsule | `10` | Total files allowed |

## Environment Files

The application supports multiple environment files for different deployment scenarios:

### `.env` (Local Development)
- Your personal development environment
- **Not committed to git** (in .gitignore)
- Copy from `.env.example` and customize

### `.env.development`
- Development environment template
- Contains development Firebase project configuration
- Can be committed to git (without sensitive keys)

### `.env.staging`
- Staging environment configuration
- Used for pre-production testing
- Should use a separate Firebase project

### `.env.production`
- Production environment configuration
- Used for live deployment
- Should use a production Firebase project
- **Never commit with real credentials**

### `.env.example`
- Template file showing all required variables
- Safe to commit to git
- Contains placeholder values

## Environment Validation

The application automatically validates environment variables on startup:

1. **Validation occurs in `src/lib/env-validation.ts`**
2. **Runs before React app initialization** in `src/main.tsx`
3. **Displays clear error messages** if variables are missing
4. **Logs configuration info** in development mode (without sensitive data)

### Validation Error Example

If required variables are missing, you'll see:

```
❌ Missing required environment variables:

  - VITE_FIREBASE_API_KEY
  - VITE_FIREBASE_PROJECT_ID

Please ensure you have created a .env file with all required variables.
You can copy .env.example as a starting point:

  cp .env.example .env

Then fill in the required values.
```

## Security Best Practices

### ✅ DO:
- Keep `.env` files out of version control
- Use separate Firebase projects for dev/staging/production
- Rotate API keys regularly
- Use Firebase security rules to protect data
- Set appropriate CORS policies

### ❌ DON'T:
- Commit `.env` files with real credentials
- Share API keys in public repositories
- Use production credentials in development
- Hardcode sensitive values in source code
- Expose API keys in client-side code (Firebase keys are safe as they're protected by security rules)

## Firebase Security Note

Firebase API keys in the client are **safe to expose** because:
- They identify your Firebase project, not authenticate users
- Security is enforced by Firebase Security Rules
- Authentication requires valid user credentials
- Firestore and Storage rules control data access

However, you should still:
- Configure proper security rules in Firebase
- Enable App Check for additional protection
- Monitor usage in Firebase Console
- Set up billing alerts

## Deployment

### Vercel / Netlify / Similar Platforms

Add environment variables in your platform's dashboard:

1. Go to project settings
2. Find "Environment Variables" section
3. Add each `VITE_*` variable
4. Deploy or redeploy your application

### Docker

Create a `.env` file or pass environment variables:

```bash
docker run -e VITE_FIREBASE_API_KEY=your_key \
           -e VITE_FIREBASE_PROJECT_ID=your_project \
           ... \
           your-image
```

### Traditional Hosting

1. Build with appropriate environment:
   ```bash
   npm run build  # Uses .env.production
   ```
2. Upload `dist/` folder to your hosting
3. Ensure environment variables are set during build

## Troubleshooting

### Issue: Variables not loading

**Cause:** Vite only loads variables prefixed with `VITE_`

**Solution:** Ensure all custom variables start with `VITE_`

### Issue: Changes not reflecting

**Cause:** Vite caches environment variables

**Solution:** Restart the dev server after changing `.env` files

### Issue: Build fails with "undefined" errors

**Cause:** Required environment variables missing during build

**Solution:** Ensure all required variables are set in your build environment

### Issue: Different behavior in dev vs production

**Cause:** Different environment files being used

**Solution:** Check which `.env` file is active and ensure consistency

## Getting Help

If you encounter issues with environment configuration:

1. Check this guide for common solutions
2. Verify all required variables are set
3. Check Firebase Console for correct values
4. Review browser console for validation errors
5. Check the application logs for detailed error messages

For more help, see the main [README.md](./README.md) or open an issue on GitHub.
