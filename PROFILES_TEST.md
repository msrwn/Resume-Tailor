# Profiles Feature Test Guide

## 🚀 Quick Start

### 1. Start Dev Server (if not running)
```bash
npm run dev
```

### 2. Launch App (if not running)
```bash
npm run dev:electron
```

## ✅ Test Checklist

### Test 1: View Default Profile
**Steps:**
1. Navigate to "Profiles" screen
2. Check if default profile appears in left panel
3. Click on the profile to select it

**Expected:**
- ✅ Profile list shows at least one profile
- ✅ Default profile has "Default" badge
- ✅ Clicking profile loads it in editor
- ✅ Profile name, rules, and template visible

**Status:** ⬜

---

### Test 2: Clone Profile
**Steps:**
1. Select the default profile
2. Click "New (Clone)" button
3. Verify new profile appears in list
4. Check new profile name is "{Original Name} (Copy)"

**Expected:**
- ✅ New profile created
- ✅ Appears in list
- ✅ Can be selected and edited
- ✅ Not set as default automatically

**Status:** ⬜

---

### Test 3: Edit Profile Name
**Steps:**
1. Select a profile
2. Click in the profile name input field
3. Change the name
4. Click "Save"
5. Verify name persists after reload

**Expected:**
- ✅ Name input is editable
- ✅ Save button appears when editing
- ✅ Name saves successfully
- ✅ Name persists after app restart

**Status:** ⬜

---

### Test 4: Edit Rules Text
**Steps:**
1. Select a profile
2. Click "Rules" tab (if not already active)
3. Edit the rules text
4. Click "Save"
5. Verify changes persist

**Expected:**
- ✅ Rules tab shows textarea
- ✅ Can edit rules text
- ✅ Changes save correctly
- ✅ Hash updates after save

**Status:** ⬜

---

### Test 5: Edit Template HTML
**Steps:**
1. Select a profile
2. Click "Resume Template" tab
3. Edit the HTML template
4. Click "Save"
5. Verify changes persist

**Expected:**
- ✅ Template tab shows textarea
- ✅ Can edit HTML template
- ✅ Changes save correctly
- ✅ Hash updates after save

**Status:** ⬜

---

### Test 6: Validation - Valid Profile
**Steps:**
1. Select a profile with valid content
2. Click "Validate" button
3. Check validation result

**Expected:**
- ✅ Shows success message: "✓ Validation passed"
- ✅ Green success message appears
- ✅ No errors listed

**Status:** ⬜

---

### Test 7: Validation - Invalid Profile
**Steps:**
1. Select a profile
2. Clear the rules text (delete all content)
3. Click "Validate" button
4. Check validation result

**Expected:**
- ✅ Shows error message
- ✅ Lists specific errors
- ✅ Red error message appears
- ✅ Error: "Rules text cannot be empty"

**Status:** ⬜

---

### Test 8: Validation - Missing HTML Tags
**Steps:**
1. Select a profile
2. Edit template to remove `<html>` tag
3. Click "Validate" button

**Expected:**
- ✅ Shows validation error
- ✅ Error: "Template must contain <html> tag"

**Status:** ⬜

---

### Test 9: Set Default Profile
**Steps:**
1. Create/clone a profile (not default)
2. Select the non-default profile
3. Click "Set Default" button
4. Verify old default loses badge
5. Verify new profile gets "Default" badge

**Expected:**
- ✅ "Set Default" button visible for non-default profiles
- ✅ Clicking sets new default
- ✅ Old default badge removed
- ✅ New default badge appears
- ✅ Only one default at a time

**Status:** ⬜

---

### Test 10: Archive Profile
**Steps:**
1. Select a non-default profile
2. Click "Archive" button
3. Confirm archive in dialog
4. Verify profile disappears from list

**Expected:**
- ✅ Archive button visible
- ✅ Confirmation dialog appears
- ✅ Profile removed from list after archive
- ✅ Cannot archive default profile (or another becomes default)

**Status:** ⬜

---

### Test 11: Hash Display
**Steps:**
1. Select a profile
2. Edit and save rules text
3. Check footer shows updated rules hash
4. Edit and save template
5. Check footer shows updated template hash

**Expected:**
- ✅ Hash values displayed in footer
- ✅ Hashes update after save
- ✅ Hash format: first 8 characters + "..."
- ✅ Different content = different hash

**Status:** ⬜

---

### Test 12: Cancel Edit
**Steps:**
1. Select a profile
2. Make changes to name, rules, or template
3. Click "Cancel" button
4. Verify changes are discarded

**Expected:**
- ✅ Cancel button appears when editing
- ✅ Clicking cancel discards changes
- ✅ Original values restored
- ✅ Editing mode exits

**Status:** ⬜

---

## 🐛 Troubleshooting

### Database Not Available
**Symptom:** Error message about database
**Solution:** 
- Install Visual Studio Build Tools
- Run: `npm rebuild better-sqlite3`
- Restart app

### Profile Not Saving
**Check:**
- Are you clicking "Save" button?
- Check console for errors (F12)
- Verify database is working

### Validation Not Working
**Check:**
- Rules text is not empty
- Template has `<html>` and `<body>` tags
- Check console for errors

## 📊 Test Results Summary

- Total Tests: 12
- Passed: ___
- Failed: ___
- Not Tested: ___

## 💡 Tips

1. **Use DevTools**: Press F12 to see console logs
2. **Check Hashes**: Verify hashes change when content changes
3. **Test Persistence**: Restart app to verify saves persist
4. **Multiple Profiles**: Create 3+ profiles to test list behavior

---

**Ready to test?** Start with Test 1 and work through the list!
