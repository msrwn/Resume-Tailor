# Fix: better-sqlite3 build on Node.js 24 (ClangCL required)

**You can run the app without the database:** `better-sqlite3` is now an **optional** dependency. If the build fails, `npm i` still succeeds and the app starts; database features (profiles, history) will show an error until you fix the build (see below) or use Node 20.

## The error you're seeing

```
error MSB8020: The build tools for ClangCL (Platform Toolset = 'ClangCL') cannot be found.
To build using the ClangCL build tools, please install ClangCL build tools.
```

## Why this happens

**Node.js 24** on Windows uses **ClangCL** (not MSVC) to build native addons. So building `better-sqlite3` requires the Clang/LLVM components in Visual Studio 2022 Build Tools. If only the default “Desktop development with C++” (MSVC) is installed, the build will fail with MSB8020.

## Fix: Install ClangCL components

### Step 1: Open Visual Studio Installer

- Press **Win**, type **Visual Studio Installer**, open it.

### Step 2: Modify Build Tools 2022

1. Find **Visual Studio Build Tools 2022**.
2. Click **Modify**.

### Step 3: Add Clang components

1. Open the **Individual components** tab.
2. Search for **Clang**.
3. Enable:
   - **C++ Clang Compiler for Windows**
   - **MSBuild support for LLVM (clang-cl) toolset**
4. Click **Modify** and wait for the install to finish.

### Step 4: Rebuild

Close any app that might be using the project (e.g. Electron, VS Code in the project folder), then:

```powershell
cd D:\resume_tailor
npm rebuild better-sqlite3
```

If you still see file-in-use errors, run `fix-file-lock.bat` first, then `npm rebuild better-sqlite3`.

## Alternative: Use Node 20 LTS (no ClangCL needed)

Node 20 uses MSVC to build native addons. If you have "Desktop development with C++" (MSVC v143), you don't need ClangCL: install [Node 20 LTS](https://nodejs.org/) or use nvm-windows (`nvm install 20` then `nvm use 20`). This repo has `.nvmrc` set to `20`. Then run `Remove-Item -Recurse -Force node_modules; npm i` and `better-sqlite3` should build.

## Optional: Clean rebuild

If the build folder was left in a bad state:

```powershell
Remove-Item -Recurse -Force node_modules\better-sqlite3\build -ErrorAction SilentlyContinue
npm rebuild better-sqlite3
```

## Summary

| Item | What to do |
|------|------------|
| **Node 24 on Windows** | Uses ClangCL for native builds |
| **Error MSB8020** | ClangCL toolset not installed |
| **Fix** | Install “C++ Clang Compiler for Windows” + “MSBuild support for LLVM (clang-cl)” in VS Installer → Individual components |
| **Then** | `npm rebuild better-sqlite3` |
