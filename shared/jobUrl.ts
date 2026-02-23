/**
 * URL normalization and platform detection for job URLs (Apply Automation feature).
 * Used by pipeline (before saving generation) and by local server (/match).
 */

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'lever-source',
]);

/** Platform ID from hostname (lever, ashby, workday, smartrecruiters, other). */
export function getPlatformId(hostname: string): string {
  const h = hostname.toLowerCase();
  if (h.includes('lever.co')) return 'lever';
  if (h.includes('ashbyhq.com')) return 'ashby';
  if (h.includes('myworkdayjobs.com')) return 'workday';
  if (h.includes('smartrecruiters.com')) return 'smartrecruiters';
  return 'other';
}

export type NormalizeJobUrlResult = {
  normalizedUrl: string | null;
  platformId: string;
};

/**
 * Normalize a job URL for matching: lowercase hostname, strip fragment and tracking params.
 * Invalid or empty URL returns { normalizedUrl: null, platformId: 'other' }.
 */
export function normalizeJobUrl(url: string | null | undefined): NormalizeJobUrlResult {
  if (url == null || typeof url !== 'string') {
    return { normalizedUrl: null, platformId: 'other' };
  }

  const trimmed = url.trim();
  if (trimmed === '') {
    return { normalizedUrl: null, platformId: 'other' };
  }

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      return { normalizedUrl: null, platformId: 'other' };
    }

    const hostname = parsed.hostname.toLowerCase();
    let pathname = parsed.pathname || '/';
    const platformId = getPlatformId(hostname);

    // Workday: job description URL and apply URL (e.g. .../apply/autofillWithResume?source=builtin)
    // must match. Strip /apply and everything after it, and drop query for apply-style URLs.
    if (platformId === 'workday' && pathname.toLowerCase().includes('/apply')) {
      const applyIdx = pathname.toLowerCase().indexOf('/apply');
      pathname = pathname.slice(0, applyIdx) || '/';
      // Use empty search so apply-page URL matches job-page URL (no query stored for job)
      const normalizedUrl = `${protocol}//${hostname}${pathname}`;
      return { normalizedUrl, platformId };
    }

    const searchParams = parsed.searchParams;
    const kept: string[] = [];
    searchParams.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      const isUtm = lowerKey.startsWith('utm_');
      if (isUtm || TRACKING_PARAMS.has(lowerKey)) return;
      kept.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    });
    const search = kept.length > 0 ? '?' + kept.join('&') : '';

    const normalizedUrl = `${protocol}//${hostname}${pathname}${search}`;

    return { normalizedUrl, platformId };
  } catch {
    return { normalizedUrl: null, platformId: 'other' };
  }
}
