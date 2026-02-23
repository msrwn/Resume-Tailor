/**
 * ATS adapter registry. Detect current page and return adapter name.
 * Content script loads generic.js which registers the generic adapter.
 */
function getPlatformId(hostname) {
  const h = (hostname || '').toLowerCase();
  if (h.includes('myworkdayjobs.com')) return 'workday';
  if (h.includes('lever.co')) return 'lever';
  if (h.includes('ashbyhq.com')) return 'ashby';
  if (h.includes('smartrecruiters.com')) return 'smartrecruiters';
  return 'generic';
}

function detectAdapter() {
  return getPlatformId(window.location.hostname);
}

/**
 * Get the fill function for the current page. For v1 we only have generic.
 */
function getFillFn() {
  const platform = detectAdapter();
  if (window.ResumeTailorAdapters && window.ResumeTailorAdapters[platform]) {
    return window.ResumeTailorAdapters[platform];
  }
  return window.ResumeTailorAdapters && window.ResumeTailorAdapters.generic;
}

window.ResumeTailorAdapterRegistry = {
  detectAdapter,
  getFillFn,
  getPlatformId,
};
