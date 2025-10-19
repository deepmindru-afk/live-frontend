# Production Deployment Guide

## Common Production vs Development Issues

### 1. **Environment Variables**
- Development: Uses `.env.local` with debug features
- Production: Uses `.env.production` with optimizations

### 2. **Console Logging**
- Development: Full console output
- Production: Only console.error (logs disabled)

### 3. **Error Handling**
- Development: Shows user-friendly error alerts
- Production: Logs errors silently, no user alerts

### 4. **HTTPS Requirements**
- Development: Works on localhost (HTTP)
- Production: Requires HTTPS for media access

## Build Commands

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build:production
npm run start:production
```

### Clean Build
```bash
npm run clean
npm run build:production
```

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS in production
- [ ] Check environment variables
- [ ] Verify media device permissions
- [ ] Test on mobile devices
- [ ] Check browser console for errors
- [ ] Verify WebSocket connections
- [ ] Test LiveKit connections

## Common Issues

### 1. **Media Access Denied**
- Ensure HTTPS is enabled
- Check browser permissions
- Verify microphone/camera access

### 2. **WebSocket Connection Failed**
- Check server URL configuration
- Verify CORS settings
- Check network connectivity

### 3. **LiveKit Connection Issues**
- Verify LiveKit server URL
- Check authentication tokens
- Verify room permissions

### 4. **Layout Differences**
- Check CSS compilation
- Verify responsive breakpoints
- Test on different screen sizes

## Debugging Production

1. **Check Browser Console**
   - Look for JavaScript errors
   - Check network requests
   - Verify WebSocket connections

2. **Check Network Tab**
   - Verify API calls
   - Check WebSocket status
   - Look for failed requests

3. **Check Application Tab**
   - Verify localStorage/sessionStorage
   - Check service workers
   - Verify cookies

## Performance Optimizations

- Code splitting enabled
- Image optimization
- Bundle analysis available
- Production build optimizations
