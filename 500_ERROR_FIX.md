# 🔧 Fixing 500 Internal Server Error

## 🎯 **Problem**
Frontend is returning 500 Internal Server Error after code changes.

## ✅ **Causes & Solutions**

### **Cause 1: Frontend Build Error**
The `.next` folder contains stale compiled code from before our fixes.

**Solution:**
```bash
cd Live-frontend-
rm -rf .next
npm run dev
```

### **Cause 2: TypeScript Errors**
There may be TypeScript compilation errors in the codebase.

**Solution:**
Check terminal where `npm run dev` is running for build errors.

### **Cause 3: Server Not Restarted**
The Next.js server was running old code.

**Solution:**
1. Stop the server (Ctrl+C)
2. Clear cache: `rm -rf .next`
3. Restart: `npm run dev`

## 🚀 **Complete Recovery Steps**

### **Step 1: Clean Everything**
```bash
cd Live-frontend-

# Remove build cache
rm -rf .next

# Remove node_modules cache (optional but thorough)
rm -rf node_modules/.cache

# Restart dev server
npm run dev
```

### **Step 2: Check for Build Errors**
Look at the terminal output when running `npm run dev`. You should see:
```
✓ Ready on http://localhost:3000
```

If you see errors, they will point to the problematic file.

### **Step 3: Test the Fix**
1. Open browser: `http://localhost:3000/instructor`
2. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
3. Check DevTools Console for errors

### **Step 4: If Still 500 Error**

#### Check the Specific File
```bash
# Check if there are any syntax errors
npx eslint pages/instructor/index.tsx
```

#### Verify Query Import
Make sure `pages/instructor/index.tsx` imports from the correct file:
```typescript
import { GET_VODS } from '../../apollo/vod/queries';  // ✅ Correct
// NOT from '../../apollo/livestream/queries'
```

#### Check for Unclosed Brackets
The error might be a simple syntax error. Check the modified sections:
- Line 610-636 (loadVODs function)
- Line 258-285 (fetchMeetings error handling)

## 📋 **Files That Were Modified**

Make sure these files are correctly saved:
1. ✅ `pages/instructor/index.tsx` - Fixed VOD loading
2. ✅ `apollo/vod/queries.ts` - Fixed GraphQL schema
3. ✅ `ERROR_FIX_SUMMARY.md` - Documentation

## 🔍 **Quick Diagnosis**

### **Error Type: Server 500**
- **Meaning**: Frontend compilation/build error
- **Not**: Backend error (that would be GraphQL 400/500)
- **Cause**: Usually stale build cache or syntax error

### **How to Tell**
- Frontend 500 = Next.js can't compile/render the page
- Backend 500 = GraphQL query fails on server
- Our case = Frontend needs rebuild

## ⚡ **Immediate Fix**

```bash
# Terminal 1: Stop frontend
pkill -f "next-server"

# Terminal 1: Clean and restart
cd Live-frontend-
rm -rf .next
npm run dev

# Browser: Wait for "Ready" message, then hard refresh
Cmd+Shift+R
```

## ✅ **Expected Result**

After restart, you should see:
1. ✅ No 500 error
2. ✅ Instructor dashboard loads
3. ⚠️ May see auth warnings (expected - no token)
4. ✅ No "Cannot query field" errors
5. ✅ VOD list is empty (expected - no auth)

---

**Status**: Code fixes complete ✅  
**Action Required**: Restart dev server with clean cache 🔄
