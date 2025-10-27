# ✅ Deployment Checklist

## What Was Fixed

### 1. Hardcoded localhost URLs → Environment Variables
- ✅ Fixed `lib/apollo-client.ts` 
- ✅ Fixed `lib/graphql-client.ts`
- ✅ Fixed `lib/websocket-client.ts`
- ✅ Fixed `lib/socket-client.ts`

### 2. Created Environment Files
- ✅ `.env.local` - Development configuration
- ✅ `.env.production` - Production template (READY TO EDIT)

### 3. Cleaned Up
- ✅ Removed documentation files
- ✅ Removed build artifacts (tsconfig.tsbuildinfo)
- ✅ Removed duplicate env file (env-config.txt)
- ✅ Removed empty apollo/examples directory

## Current Status

✅ **Project is clean and ready for production deployment**

## Before Deploying - ACTION REQUIRED

### Step 1: Update Production URLs

Edit `.env.production` file:

```bash
cd Live-frontend-
nano .env.production
```

Replace these placeholder URLs with your actual production URLs:

```bash
# BEFORE (placeholder):
NEXT_PUBLIC_GRAPHQL_URL=https://your-backend-domain.com/graphql
NEXT_PUBLIC_BACKEND_URL=https://your-backend-domain.com
NEXT_PUBLIC_WS_URL=wss://your-backend-domain.com/signaling

# AFTER (your actual URLs):
NEXT_PUBLIC_GRAPHQL_URL=https://api.yourdomain.com/graphql
NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com/signaling
```

**Critical:** Use HTTPS/WSS (not HTTP/WS) for production!

### Step 2: Build for Production

```bash
npm run build
```

### Step 3: Test Production Build (Optional)

```bash
npm start
# Visit http://localhost:3000
# Check browser console for errors
```

### Step 4: Deploy

Deploy the `.next` folder (Next.js build output)

## Production Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_GRAPHQL_ENDPOINT` | ✅ Yes | GraphQL API endpoint |
| `NEXT_PUBLIC_GRAPHQL_URL` | ✅ Yes | Alternative GraphQL URL |
| `NEXT_PUBLIC_BACKEND_URL` | ✅ Yes | Main backend API URL |
| `NEXT_PUBLIC_WS_URL` | ✅ Yes | WebSocket endpoint |
| `NEXT_PUBLIC_SIGNALING_WS` | ✅ Yes | WebSocket signaling |
| `NEXT_PUBLIC_LIVEKIT_URL` | ✅ Yes | LiveKit WebRTC server |
| `NEXT_PUBLIC_APP_URL` | ⚠️ Recommended | Frontend URL |
| `NODE_ENV` | ✅ Yes | Set to `production` |

## Files Status

### ✅ Kept (Essential)
- All source files (`pages/`, `components/`, `lib/`, etc.)
- Configuration files (`next.config.ts`, `tsconfig.json`, etc.)
- Package files (`package.json`, `package-lock.json`)
- Environment files (`.env.local`, `.env.production`)

### ❌ Removed (Unnecessary)
- Documentation files (*.md)
- Build artifacts (tsconfig.tsbuildinfo)
- Duplicate env files (env-config.txt)
- Empty directories (apollo/examples)

### 📁 Ignored by Git (via .gitignore)
- `node_modules/`
- `.next/`
- `.env*` files
- Build files

## Deployment Commands

### Using npm:
```bash
npm run build
npm start
```

### Using PM2:
```bash
npm run build
pm2 start npm --name "hrde-frontend" -- start
```

### Using Docker:
```bash
npm run build
docker build -t hrde-frontend .
docker run -p 3000:3000 hrde-frontend
```

## Verification

After deployment, verify:

1. ✅ Application loads without errors
2. ✅ GraphQL queries work
3. ✅ Authentication works
4. ✅ WebSocket connections work
5. ✅ LiveKit video works
6. ✅ No console errors
7. ✅ API calls go to production backend, not localhost

## Common Issues

### Issue: Still connecting to localhost
**Solution:** Check `.env.production` has correct production URLs (not localhost)

### Issue: CORS errors
**Solution:** Ensure backend CORS settings allow your production domain

### Issue: WebSocket fails
**Solution:** 
- Use `wss://` (not `ws://`) in production
- Verify backend WebSocket server is configured for HTTPS

### Issue: Mixed content errors
**Solution:** Use HTTPS for all production URLs

## Status Summary

✅ **All files cleaned and ready for production**
✅ **Production fix implemented (no hardcoded localhost)**
✅ **Environment files created**
✅ **Build passes without errors**

**Next Step:** Edit `.env.production` with your production URLs and deploy!

