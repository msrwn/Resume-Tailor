# Install C++ Workload - Step by Step

## ✅ Current Status
- ✅ Visual Studio Build Tools 2022: **Installed**
- ✅ Visual Studio Installer: **Available**
- ❌ C++ Workload: **Missing** (this is the problem!)

## 🎯 Solution: Install C++ Workload

### Method 1: Visual Studio Installer (Recommended)

**Step 1: Open Visual Studio Installer**
- Press `Win` key
- Type: **"Visual Studio Installer"**
- Click to open

**Step 2: Modify Build Tools**
1. Find **"Visual Studio Build Tools 2022"**
2. Click the **"Modify"** button (or "More" → "Modify")

**Step 3: Select C++ Workload**
1. In the "Workloads" tab, find:
   - ✅ **"Desktop development with C++"**
2. Check the box
3. On the right side, verify these are included:
   - ✅ MSVC v143 - VS 2022 C++ x64/x86 build tools (Latest)
   - ✅ Windows 10/11 SDK (latest)
   - ✅ C++ CMake tools for Windows

**Step 3b: Node.js 24 – add ClangCL (required for native modules)**  
If you use **Node.js 24**, native addons (e.g. `better-sqlite3`) use **ClangCL**, not MSVC. After selecting the workload:
1. Open the **Individual components** tab.
2. Search for **Clang**.
3. Also check:
   - ✅ **C++ Clang Compiler for Windows**
   - ✅ **MSBuild support for LLVM (clang-cl) toolset**  
See **NODE24_CLANGCL.md** if you see error MSB8020 (ClangCL not found).

**Step 4: Install**
1. Click **"Modify"** button at bottom right
2. Wait for installation (~5-10 minutes, ~3-6 GB download)
3. May require restart

**Step 5: Rebuild**
After installation completes:
```bash
npm rebuild better-sqlite3
```

### Method 2: Command Line (Advanced)

If you prefer command line:

```powershell
# Run as Administrator
& "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vs_installer.exe" modify `
  --installPath "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools" `
  --add Microsoft.VisualStudio.Workload.VCTools `
  --includeRecommended `
  --passive
```

## 🔍 Verify Installation

After installing, check:
```powershell
# This should return True after installation
Test-Path "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC"
```

## ⚡ Quick Steps Summary

1. Open **Visual Studio Installer**
2. Click **Modify** on Build Tools 2022
3. Check **"Desktop development with C++"**
4. Click **Modify** to install
5. Wait for completion
6. Run: `npm rebuild better-sqlite3`

## 📝 What This Installs

The C++ workload includes:
- **MSVC Compiler** (v143) - Required for compilation
- **Windows SDK** - Required for Windows APIs
- **CMake Tools** - Build system support
- **Other C++ tools** - Various utilities

**Total size:** ~3-6 GB
**Time:** ~5-10 minutes (depending on internet speed)

## ✅ After Installation

Once installed, you'll be able to:
- ✅ Compile `better-sqlite3`
- ✅ Use database features
- ✅ Create/edit profiles
- ✅ View history

---

**The installer is ready - just need to add the C++ workload!** 🚀
