/**
 * Chrome storage helpers for Resume Tailor Autofill.
 * Keys: profileId, profileName, baseUrl (cached server base URL).
 */
const RESUME_TAILOR_KEYS = {
  PROFILE_ID: 'resumeTailor_profileId',
  PROFILE_NAME: 'resumeTailor_profileName',
  BASE_URL: 'resumeTailor_baseUrl',
};

async function getStoredProfile() {
  const out = await chrome.storage.local.get([RESUME_TAILOR_KEYS.PROFILE_ID, RESUME_TAILOR_KEYS.PROFILE_NAME]);
  return {
    profileId: out[RESUME_TAILOR_KEYS.PROFILE_ID] || null,
    profileName: out[RESUME_TAILOR_KEYS.PROFILE_NAME] || null,
  };
}

async function setStoredProfile(profileId, profileName) {
  await chrome.storage.local.set({
    [RESUME_TAILOR_KEYS.PROFILE_ID]: profileId || null,
    [RESUME_TAILOR_KEYS.PROFILE_NAME]: profileName || null,
  });
}

async function getBaseUrl() {
  const out = await chrome.storage.local.get([RESUME_TAILOR_KEYS.BASE_URL]);
  return out[RESUME_TAILOR_KEYS.BASE_URL] || null;
}

async function setBaseUrl(url) {
  await chrome.storage.local.set({ [RESUME_TAILOR_KEYS.BASE_URL]: url });
}

// Export for use in both popup and content script (same global when loaded in order).
window.ResumeTailorStorage = {
  getStoredProfile,
  setStoredProfile,
  getBaseUrl,
  setBaseUrl,
};
