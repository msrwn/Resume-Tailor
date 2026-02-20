# Fix: Missing VC++ Toolset

## Problem
Visual Studio Build Tools 2022 is installed, but the **VC++ toolset is missing**.

Error message:
```
- found "Visual Studio C++ core features"
- missing any VC++ toolset
```

## Solution: Install C++ Workload

### Step 1: Open Visual Studio Installer
1. Press `Win + R`
2. Type: `appwiz.cpl` and press Enter
3. Or search for "Visual Studio Installer" in Start menu

### Step 2: Modify Build Tools
1. Find **"Visual Studio Build Tools 2022"**
2. Click **"Modify"** button

### Step 3: Install C++ Workload
1. Check the box: **"Desktop development with C++"**
2. Make sure these are selected:
   - ✅ MSVC v143 - VS 2022 C++ x64/x86 build tools (Latest)
   - ✅ Windows 10/11 SDK (latest version)
   - ✅ C++ CMake tools for Windows
3. Click **"Modify"** button
4. Wait for installation (~5-10 minutes)

### Step 4: Rebuild
After installation completes:
```bash
npm rebuild better-sqlite3
```

## Alternative: Quick Install via Command Line

If you have the installer downloaded, you can also run:

```bash
# Download installer first, then:
"C:\Program Files (x86)\Microsoft Visual Studio\Installer\vs_installer.exe" modify --installPath "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools" --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --quiet
```

## Verify Installation

After installing, verify:
```bash
# Check if toolset exists
Test-Path "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC"

# Rebuild
npm rebuild better-sqlite3
```

## What You Need

The **"Desktop development with C++"** workload includes:
- MSVC compiler (v143)
- Windows SDK
- CMake tools
- Other C++ build tools

This is what `better-sqlite3` needs to compile.

## Quick Summary

1. ✅ Build Tools installed (good!)
2. ❌ C++ workload missing (needs installation)
3. 🔧 Install "Desktop development with C++" workload
4. ✅ Rebuild: `npm rebuild better-sqlite3`

---

**After installing the workload, the rebuild should work!**
