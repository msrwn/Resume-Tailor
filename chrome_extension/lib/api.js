/**
 * Resume Tailor autofill server API.
 * Base URL: try dev (38421) then prod (38422); cache in storage.
 * /match must be called with encodeURIComponent(tabUrl) for url param.
 */
const PORTS = [38421, 38422];
const RESUME_TAILOR_BASE_URLS = PORTS.map((p) => `http://127.0.0.1:${p}`);

async function getBaseUrl() {
  if (window.ResumeTailorStorage) {
    const cached = await window.ResumeTailorStorage.getBaseUrl();
    if (cached) {
      const ok = await health(cached);
      if (ok) return cached;
    }
  }
  for (const base of RESUME_TAILOR_BASE_URLS) {
    const ok = await health(base);
    if (ok) {
      if (window.ResumeTailorStorage) await window.ResumeTailorStorage.setBaseUrl(base);
      return base;
    }
  }
  return null;
}

async function health(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/health`, { method: 'GET' });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.ok === true;
  } catch {
    return false;
  }
}

async function profiles(baseUrl) {
  const res = await fetch(`${baseUrl}/profiles`, { method: 'GET' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Failed to list profiles (${res.status})`);
  }
  return res.json();
}

async function autofill(baseUrl, profileId) {
  const res = await fetch(`${baseUrl}/autofill?profileId=${encodeURIComponent(profileId)}`, { method: 'GET' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Failed to get autofill (${res.status})`);
  }
  return res.json();
}

/**
 * Match job by URL and profile. url must be the full tab URL (we encode it here).
 */
async function match(baseUrl, url, profileId) {
  const encodedUrl = encodeURIComponent(url);
  const res = await fetch(
    `${baseUrl}/match?url=${encodedUrl}&profileId=${encodeURIComponent(profileId)}`,
    { method: 'GET' }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Match failed (${res.status})`);
  }
  return res.json();
}

window.ResumeTailorApi = {
  getBaseUrl,
  health,
  profiles,
  autofill,
  match,
  PORTS,
  RESUME_TAILOR_BASE_URLS,
};
