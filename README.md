# Resume Tailor Desktop App

A local-first Electron desktop application for tailoring resumes to job descriptions.

## Features

- **One-click generation**: Paste JD → Generate → PDFs + JD saved
- **Local-first**: All data stored locally on your machine
- **Profiles**: Multiple Rules + HTML Template bundles
- **Traceability**: Every output attributable to exact Profile and model config
- **Zero overwrites**: Collision-proof folder structure
- **Fast retrieval**: Search by company/role/keywords

## Development

### Prerequisites

- **Node.js 18+** (Node 20 LTS recommended; avoids ClangCL on Windows)
- npm

### Setup (first time or after clone)

```bash
npm install
```

**If you use Electron and need the database:** rebuild the native module for Electron (required once per `npm install`):

```bash
npm run rebuild:electron
```

### Run in Development

**Option A – Two terminals**

1. Terminal 1 – start watchers (main process + Vite):
   ```bash
   npm run dev
   ```
2. Terminal 2 – when Vite is ready, start Electron:
   ```bash
   npm run dev:electron
   ```

**Option B – One shot**

After `npm run dev` is running and Vite is up, in another terminal:

```bash
npm run dev:electron
```

This builds the main process once, waits for http://127.0.0.1:5173, then launches Electron against the Vite dev server.

---

## Production build

### 1. Build the app

Compiles main process (TypeScript) and renderer (Vite/React):

```bash
npm run build
```

Output: `dist/main/`, `dist/renderer/`.

### 2. Package (installer)

**Windows (NSIS installer):**

```bash
npm run package:win
```

**Current platform (Windows/mac/Linux):**

```bash
npm run package
```

Installers and unpacked app go to **`dist-electron/`**.

**If packaging fails with "Access is denied" (e.g. on `d3dcompiler_47.dll`) or `ERR_ELECTRON_BUILDER_CANNOT_EXECUTE`:**

1. **Stop the dev app** – Close any running Electron window (e.g. from `npm run dev:electron`) so it doesn’t lock files.
2. **Clean and retry** – Delete the output folder and caches, then package again.

   **PowerShell:**
   ```powershell
   Remove-Item -Recurse -Force dist-electron -ErrorAction SilentlyContinue
   Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron\Cache" -ErrorAction SilentlyContinue
   Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron-builder\Cache" -ErrorAction SilentlyContinue
   npm run package:win
   ```

   **CMD:**
   ```cmd
   rmdir /s /q dist-electron 2>nul
   rmdir /s /q "%LOCALAPPDATA%\electron\Cache" 2>nul
   rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache" 2>nul
   npm run package:win
   ```
3. **Antivirus** – Temporarily exclude the project folder (and `%LOCALAPPDATA%\electron*`) from real-time scanning if it still fails.
4. **Retry in a new terminal** – Run `npm run package:win` in a new PowerShell/CMD window (not the one that was running the dev server).

**If the desktop/Start menu shortcut still shows the default icon after installing:**  
Windows caches icons. Do a clean reinstall: uninstall "Resume Tailor", delete the desktop shortcut if it remains, then run the installer again. If the shortcut still shows the old icon, restart Windows or clear the icon cache (e.g. restart Explorer or use a cache-clear tool).

## Project Structure

```
resume_tailor/
├── main/          # Electron main process
├── renderer/      # React UI
├── shared/        # Shared types, schemas, utils
├── docs/          # Documentation (PRD, TRD, IMPLEMENTATION)
└── dist/          # Build output
```

## Documentation

See `docs/` folder for:
- `PRD.md` - Product Requirements Document
- `TRD.md` - Technical Requirements Document  
- `IMPLEMENTATION.md` - Implementation plan with milestones
- `FEATURES.md` - Feature documentation index
- `features/` - Individual feature implementation plans

See `CHANGELOG.md` for version history and changes.
