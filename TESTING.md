# Testing Guide

## Prerequisites

### For Database Features (Milestone 3+)

`better-sqlite3` requires native compilation. You need one of the following:

**Option 1: Visual Studio Build Tools (Recommended)**
1. Download Visual Studio Build Tools: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
2. Install with "Desktop development with C++" workload
3. Run: `npm rebuild better-sqlite3`

**Option 2: Full Visual Studio**
- Install Visual Studio with C++ development tools

**Option 3: Test Without Database**
- The app will run but database features will fail gracefully
- You can test UI and config features without the database

## Running Tests

### 1. Start Development Server

Terminal 1:
```bash
npm run dev
```

This starts:
- TypeScript compiler (watching main process)
- Vite dev server (renderer process) on http://127.0.0.1:5173

### 2. Launch Electron App

Terminal 2 (after Vite is ready):
```bash
npm run dev:electron
```

## Testing Checklist

### Milestone 1 & 2: Basic App + Config
- [x] App launches successfully
- [x] Navigation works (Generate, History, Profiles, Settings)
- [x] Settings screen loads
- [x] Can set output root path (Browse button)
- [x] Can set/clear API key
- [x] Config persists after restart

### Milestone 3: Database + History
- [ ] Database file created at `{appDataDir}/app.db`
- [ ] Default profile seeded on first launch
- [ ] History screen loads (empty initially)
- [ ] History search works
- [ ] Profiles screen shows default profile

### Known Issues
- `better-sqlite3` requires native compilation - see Prerequisites above
- If database fails to initialize, you'll see errors in console but app continues

## Manual Testing Steps

### Test Config System
1. Open Settings
2. Click "Browse..." to select output root path
3. Enter a test API key
4. Click "Save Settings"
5. Restart app - settings should persist

### Test Database (if compiled)
1. Check `%APPDATA%\resume-tailor\app.db` exists
2. Open History screen - should show empty list
3. Open Profiles screen - should show "Default Profile"

### Test History Screen
1. Navigate to History
2. Try search with empty query (should show all)
3. Try search with keyword
4. Verify UI displays correctly

## Troubleshooting

### Database Errors
If you see "Database initialization failed":
- Ensure Visual Studio Build Tools are installed
- Run: `npm rebuild better-sqlite3`
- Check console for detailed error messages

### Electron Won't Launch
- Ensure Vite dev server is running on port 5173
- Check `dist/main/index.js` exists (run `npm run build:main`)
- Check Electron binary exists: `node_modules\electron\dist\electron.exe`

### TypeScript Errors
- Run: `npm run typecheck` to see all errors
- Run: `npm run build:main` to compile main process
- Run: `npm run build:renderer` to compile renderer
