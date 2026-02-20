# Quick Test Guide

## 🚀 Start Testing

### Step 1: Start Dev Server
```bash
npm run dev
```
Wait for: `VITE ready` message

### Step 2: Launch App
```bash
npm run dev:electron
```

## ✅ Quick Test Checklist

### 1. Navigation (30 seconds)
- [ ] Click "Generate" → See placeholder
- [ ] Click "History" → See search box
- [ ] Click "Profiles" → See profiles or error message
- [ ] Click "Settings" → See settings form

### 2. Settings - Output Path (1 minute)
- [ ] Click "Browse..." button
- [ ] Select a folder
- [ ] Click "Save Settings"
- [ ] See success message
- [ ] Restart app → Path persists ✅

### 3. Settings - API Key (1 minute)
- [ ] Enter test key: `test-key-12345`
- [ ] Click "Set"
- [ ] See success + "Update/Clear" buttons appear
- [ ] Click "Clear"
- [ ] Key cleared ✅

### 4. Settings - Models (30 seconds)
- [ ] Fill in model names
- [ ] Adjust retry counts
- [ ] Toggle fallback checkbox
- [ ] Save → Restart → Values persist ✅

### 5. History Screen (30 seconds)
- [ ] Search box visible
- [ ] Type "test" → Click Search
- [ ] Click Clear
- [ ] UI renders correctly ✅

### 6. Profiles Screen (30 seconds)
- [ ] Screen loads
- [ ] Shows error message OR default profile
- [ ] Error message is helpful ✅

### 7. Test Helper (10 seconds)
- [ ] See small box in bottom-right corner
- [ ] Shows: Version, API Key status, Output Path status
- [ ] Click it → See details in console ✅

## 🐛 Expected Issues

### Database Error (Normal)
If you see: "Database not available"
- This is expected if `better-sqlite3` isn't compiled
- App continues working for UI/config features
- To fix: Install Visual Studio Build Tools + run `npm rebuild better-sqlite3`

### Cache Warnings (Harmless)
If you see: "Unable to move the cache"
- These are harmless Chromium warnings
- Can be ignored

## 📊 Test Results

Mark each test as you complete it:
- ✅ Pass
- ❌ Fail  
- ⏭️ Skip

## 💡 Tips

1. **Check Console**: Open DevTools (F12) to see detailed logs
2. **Test Helper**: Click the bottom-right box for app state info
3. **Restart Test**: Close and reopen app to test persistence
4. **Database**: If you want to test database features, compile better-sqlite3 first

## 🎯 What Should Work

✅ All navigation
✅ Settings save/load
✅ API key storage (Windows Credential Manager)
✅ History UI (even without database)
✅ Profiles UI (shows error gracefully)
✅ Error handling (app doesn't crash)

## ❌ What Won't Work Yet

❌ Database features (without better-sqlite3 compiled)
❌ Actual profile CRUD (needs database)
❌ History search results (needs database)
❌ Generate functionality (not implemented yet)
