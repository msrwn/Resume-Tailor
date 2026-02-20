# Milestone 5 Test Guide - Filesystem & Open Folder

## What to Test

### 1. History Screen - Open Folder / Open File
**When:** You have at least one successful generation (or we can add a test entry)

**Steps:**
1. Navigate to **History**
2. If you have results with `output_dir`:
   - Click **"Open Folder"** → Should open the output folder in File Explorer
   - Click **"Open Resume PDF"** (if path exists) → Should open the PDF
3. If History is empty:
   - This is expected until you run a full generation (Milestone 6+)
   - Open Folder/Open File will appear once you have generation data

**Expected:**
- No errors when clicking
- Folder opens in system file manager
- File opens with default application

---

### 2. Settings - Output Path (prerequisite for generation)
**Steps:**
1. Go to **Settings**
2. Click **Browse** and select a folder (e.g. `D:\resume_output` or Desktop)
3. Click **Save Settings**
4. Restart app → Path should persist

**Expected:**
- Path saves
- Persists after restart
- This path will be used when generation runs (Milestone 6+)

---

### 3. Profiles (already working)
**Quick check:**
1. Go to **Profiles**
2. Default profile visible
3. Clone, edit, save, validate still work

---

### 4. Unit Tests (automated)
Run:
```bash
npm test
```

**Covers:**
- `sanitizePathSegment` (shared/utils)
- `formatDateFolder` (shared/utils)
- `versionedFilePath` (main/fs)
- `buildOutputDirectory` (main/fs)
- `extractOwnerFirstName` (main/fs)
- Collision handling
- Version increment (_v2, _v3)

---

## Test Checklist

- [ ] Settings: Output path set and persists
- [ ] History: If any item has output_dir → Open Folder works
- [ ] History: If resume_pdf_path exists → Open Resume PDF works
- [ ] Profiles: Still works (clone, edit, validate)
- [ ] Run `npm test` → All tests pass

---

## Note

**Open Folder / Open File** need generation records with `output_dir` and file paths. Those are created when you run the full **Generate** flow (Milestone 6–8). Until then:

- History may be empty → no "Open Folder" to click
- You can still verify: Settings, Profiles, navigation, and that the app runs

After we implement the generation pipeline, you'll get real output folders and can test Open Folder/Open File end-to-end.

---

## Quick Commands

```bash
# Run unit tests
npm test

# Run app (if not already)
npm run dev
npm run dev:electron
```
