# Database Setup Guide - Fixing better-sqlite3

## Problem
`better-sqlite3` requires native compilation. The error indicates Visual Studio Build Tools are not properly configured.

### If you see: **MSB8020 – ClangCL cannot be found** (Node.js 24)
Node.js 24 on Windows uses **ClangCL** for native builds. Install the Clang components in Visual Studio Installer → Individual components. **See [NODE24_CLANGCL.md](NODE24_CLANGCL.md) for step-by-step instructions.**

## Solution Options

### Option 1: Install Visual Studio Build Tools (Recommended)

1. **Download Visual Studio Build Tools 2022**
   - Go to: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
   - Download "Build Tools for Visual Studio 2022"

2. **Install with C++ Workload**
   - Run the installer
   - Select "Desktop development with C++" workload
   - Make sure these components are included:
     - MSVC v143 - VS 2022 C++ x64/x86 build tools
     - Windows 10/11 SDK (latest version)
     - C++ CMake tools for Windows

3. **Rebuild better-sqlite3**
   ```bash
   npm rebuild better-sqlite3
   ```

4. **Restart the app**
   - Close Electron app
   - Restart: `npm run dev:electron`

### Option 2: Use Visual Studio Developer Command Prompt

If Build Tools are installed but not detected:

1. **Open Developer Command Prompt**
   - Search for "Developer Command Prompt for VS 2022"
   - Or navigate to: `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat`

2. **Navigate to project**
   ```bash
   cd d:\resume_tailor
   ```

3. **Rebuild**
   ```bash
   npm rebuild better-sqlite3
   ```

### Option 3: Install Full Visual Studio (Alternative)

If Build Tools don't work:

1. **Download Visual Studio Community 2022** (Free)
   - https://visualstudio.microsoft.com/downloads/
   - Select "Community" edition

2. **Install with C++ Desktop Development**
   - During installation, select "Desktop development with C++"
   - This includes all necessary build tools

3. **Rebuild**
   ```bash
   npm rebuild better-sqlite3
   ```

### Option 4: Test Without Database (Temporary)

You can test the UI features without database:

- **Settings screen**: ✅ Works (no database needed)
- **Profiles UI**: ⚠️ Shows error but UI is functional
- **History UI**: ⚠️ Shows error but UI is functional
- **Navigation**: ✅ Works

The app will continue running, just database features won't work.

## Verify Installation

After installing Build Tools, verify:

```bash
# Check if node-gyp can find Visual Studio
npm config get msvs_version

# Try rebuilding
npm rebuild better-sqlite3

# Check if binary exists
Test-Path "node_modules\better-sqlite3\build\Release\better_sqlite3.node"
```

## Quick Check

Run this to see what's detected:
```bash
npm config list
```

## Troubleshooting

### "Could not find Visual Studio"
- Make sure Build Tools are installed
- Restart terminal/command prompt after installation
- Try Option 2 (Developer Command Prompt)

### "Python not found"
- Python 3.11.9 is detected (good!)
- If missing, install Python 3.x from python.org

### "Access Denied" errors
- Run command prompt as Administrator
- Check antivirus isn't blocking compilation

## After Successful Build

Once `better-sqlite3` compiles:

1. **Restart app**
2. **Database will initialize automatically**
3. **Default profile will be seeded**
4. **All features will work**

## Current Status

- ✅ Python detected: Python 3.11.9
- ❌ Visual Studio Build Tools: Not properly configured
- ❌ better-sqlite3: Not compiled

## Next Steps

1. Install Visual Studio Build Tools (Option 1)
2. Rebuild: `npm rebuild better-sqlite3`
3. Restart app
4. Test Profiles feature!

---

**Need help?** The app UI works without database - you can test navigation and settings while setting up the database.
