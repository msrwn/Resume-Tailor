/**
 * Background service worker: all fetch() to 127.0.0.1 run here so localhost
 * connection works reliably (popup/content fetch to localhost can fail in Chrome).
 */
const PORTS = [38421, 38422];
const BASE_URLS = PORTS.map((p) => `http://127.0.0.1:${p}`);
const HEALTH_TIMEOUT_MS = 3000;
const STORAGE_KEY_BASE_URL = 'resumeTailor_baseUrl';

function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

async function health(baseUrl) {
  try {
    const res = await fetchWithTimeout(
      baseUrl + '/health',
      { method: 'GET' },
      HEALTH_TIMEOUT_MS
    );
    const data = await res.json().catch(() => ({}));
    return res.ok && data.ok === true;
  } catch {
    return false;
  }
}

async function getBaseUrl() {
  const cached = (await chrome.storage.local.get([STORAGE_KEY_BASE_URL]))[STORAGE_KEY_BASE_URL];
  if (cached) {
    const ok = await health(cached);
    if (ok) return cached;
  }
  for (const base of BASE_URLS) {
    const ok = await health(base);
    if (ok) {
      await chrome.storage.local.set({ [STORAGE_KEY_BASE_URL]: base });
      return base;
    }
  }
  return null;
}

async function profiles(baseUrl) {
  const res = await fetch(baseUrl + '/profiles', { method: 'GET' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || 'Failed to list profiles (' + res.status + ')');
  }
  return res.json();
}

async function autofill(baseUrl, profileId) {
  const res = await fetch(
    baseUrl + '/autofill?profileId=' + encodeURIComponent(profileId),
    { method: 'GET' }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || 'Failed to get autofill (' + res.status + ')');
  }
  return res.json();
}

async function match(baseUrl, url, profileId) {
  const res = await fetch(
    baseUrl + '/match?url=' + encodeURIComponent(url) + '&profileId=' + encodeURIComponent(profileId),
    { method: 'GET' }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || 'Match failed (' + res.status + ')');
  }
  return res.json();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const t = msg && msg.type;
  if (t === 'getBaseUrl') {
    getBaseUrl().then((baseUrl) => sendResponse({ baseUrl })).catch((e) => sendResponse({ baseUrl: null, error: e.message }));
    return true;
  }
  if (t === 'profiles') {
    profiles(msg.baseUrl)
      .then((list) => sendResponse({ list }))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }
  if (t === 'autofill') {
    autofill(msg.baseUrl, msg.profileId)
      .then((data) => sendResponse({ data }))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }
  if (t === 'match') {
    match(msg.baseUrl, msg.url, msg.profileId)
      .then((data) => sendResponse({ data }))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }
  return false;
});
