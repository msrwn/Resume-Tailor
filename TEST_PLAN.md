# Test Plan - Current Implementation

## Test Environment Setup

1. **Start Dev Server** (Terminal 1):
   ```bash
   npm run dev
   ```
   Wait for: "VITE ready in XXX ms" and "Local: http://127.0.0.1:5173/"

2. **Launch Electron** (Terminal 2):
   ```bash
   npm run dev:electron
   ```

## Test Cases

### ✅ Test 1: App Launch & Navigation
**Steps:**
1. Verify Electron window opens
2. Check sidebar navigation appears
3. Click each nav item: Generate, History, Profiles, Settings

**Expected:**
- Window opens without errors
- All 4 navigation buttons visible
- Clicking each button switches screens
- No console errors (except database warning if better-sqlite3 not compiled)

**Status:** ⬜ Not Tested

---

### ✅ Test 2: Settings Screen - Output Path
**Steps:**
1. Navigate to Settings
2. Click "Browse..." button next to "Output Root Path"
3. Select a folder in the file picker
4. Verify path appears in the input field
5. Click "Save Settings"
6. Check for success message
7. Close and reopen app
8. Navigate to Settings again

**Expected:**
- File picker opens
- Selected path appears in field
- Save shows success message
- Path persists after restart

**Status:** ⬜ Not Tested

---

### ✅ Test 3: Settings Screen - API Key Management
**Steps:**
1. Navigate to Settings
2. Check "API Key" section
3. Enter a test API key (e.g., "test-key-12345")
4. Click "Set" button
5. Verify success message
6. Verify placeholder shows "••••••••••••"
7. Click "Clear" button
8. Verify key is cleared
9. Verify "Set" button appears again

**Expected:**
- API key can be set
- Key is stored securely (check Windows Credential Manager)
- Key can be cleared
- UI updates correctly

**Status:** ⬜ Not Tested

---

### ✅ Test 4: Settings Screen - Model Configuration
**Steps:**
1. Navigate to Settings
2. Fill in model fields:
   - JD Extraction Model: "gpt-4o-mini"
   - Resume Payload Model: "gpt-4o"
   - Fallback Model: "gpt-3.5-turbo"
3. Adjust retry counts (Call A: 2, Call B: 2)
4. Toggle "Enable Fallback Model" checkbox
5. Click "Save Settings"
6. Restart app and verify values persist

**Expected:**
- All fields accept input
- Values save correctly
- Values persist after restart

**Status:** ⬜ Not Tested

---

### ✅ Test 5: History Screen - Empty State
**Steps:**
1. Navigate to History
2. Verify screen loads
3. Check for "No applications found" message or error

**Expected:**
- Screen loads without crashing
- Shows appropriate empty state or error message
- Search input visible

**Status:** ⬜ Not Tested

---

### ✅ Test 6: History Screen - Search UI
**Steps:**
1. Navigate to History
2. Type in search box: "test"
3. Click "Search" button
4. Click "Clear" button
5. Verify search box clears

**Expected:**
- Search input works
- Search button triggers search
- Clear button clears input

**Status:** ⬜ Not Tested

---

### ✅ Test 7: Profiles Screen - Default Profile Display
**Steps:**
1. Navigate to Profiles
2. Check if default profile appears (if database working)
3. Or check if error message appears (if database not working)

**Expected:**
- Screen loads
- Shows default profile OR graceful error message

**Status:** ⬜ Not Tested

---

### ✅ Test 8: Generate Screen
**Steps:**
1. Navigate to Generate
2. Verify screen loads
3. Check placeholder text

**Expected:**
- Screen loads
- Placeholder visible

**Status:** ⬜ Not Tested

---

### ✅ Test 9: Error Handling - Database Not Available
**Steps:**
1. Launch app (with better-sqlite3 not compiled)
2. Check console/DevTools for error messages
3. Try to use History screen
4. Try to use Profiles screen

**Expected:**
- App doesn't crash
- Error messages are user-friendly
- UI still functions for non-database features

**Status:** ⬜ Not Tested

---

### ✅ Test 10: Config Persistence
**Steps:**
1. Set output root path
2. Set API key
3. Configure models
4. Save settings
5. Close app completely
6. Reopen app
7. Navigate to Settings

**Expected:**
- All settings persist
- Values appear correctly

**Status:** ⬜ Not Tested

---

## Known Issues

1. **Database**: Requires `better-sqlite3` to be compiled
   - Solution: Install Visual Studio Build Tools + C++ workload
   - Then run: `npm rebuild better-sqlite3`

2. **Cache Warnings**: Harmless Chromium warnings, can be ignored

3. **Autofill Warning**: DevTools warning, can be ignored

## Test Results Summary

- Total Tests: 10
- Passed: ___
- Failed: ___
- Not Tested: ___

## Notes

- Database features will fail gracefully if better-sqlite3 not compiled
- UI and config features work independently of database
- All IPC communication should work regardless of database status
