import { normalizeJobUrl, getPlatformId } from '../jobUrl';

describe('getPlatformId', () => {
  it('returns lever for lever.co', () => {
    expect(getPlatformId('jobs.lever.co')).toBe('lever');
    expect(getPlatformId('LEVER.co')).toBe('lever');
  });

  it('returns ashby for ashbyhq.com', () => {
    expect(getPlatformId('jobs.ashbyhq.com')).toBe('ashby');
  });

  it('returns workday for myworkdayjobs.com', () => {
    expect(getPlatformId('company.myworkdayjobs.com')).toBe('workday');
  });

  it('returns smartrecruiters for smartrecruiters.com', () => {
    expect(getPlatformId('www.smartrecruiters.com')).toBe('smartrecruiters');
  });

  it('returns other for unknown host', () => {
    expect(getPlatformId('example.com')).toBe('other');
    expect(getPlatformId('greenhouse.io')).toBe('other');
  });
});

describe('normalizeJobUrl', () => {
  it('returns null for empty or invalid URL', () => {
    expect(normalizeJobUrl(null)).toEqual({ normalizedUrl: null, platformId: 'other' });
    expect(normalizeJobUrl(undefined)).toEqual({ normalizedUrl: null, platformId: 'other' });
    expect(normalizeJobUrl('')).toEqual({ normalizedUrl: null, platformId: 'other' });
    expect(normalizeJobUrl('   ')).toEqual({ normalizedUrl: null, platformId: 'other' });
    expect(normalizeJobUrl('not-a-url')).toEqual({ normalizedUrl: null, platformId: 'other' });
  });

  it('lowercases hostname and strips fragment', () => {
    const r = normalizeJobUrl('https://Jobs.Lever.co/company/job#section');
    expect(r.normalizedUrl).toBe('https://jobs.lever.co/company/job');
    expect(r.platformId).toBe('lever');
  });

  it('strips tracking params (utm_*, gclid, fbclid, lever-source)', () => {
    const r = normalizeJobUrl(
      'https://jobs.lever.co/company/job?utm_source=twitter&gclid=abc&lever-source=LinkedIn'
    );
    expect(r.normalizedUrl).toBe('https://jobs.lever.co/company/job');
  });

  it('keeps pathname and non-tracking params', () => {
    const r = normalizeJobUrl('https://example.com/path/to/job?ref=123');
    expect(r.normalizedUrl).toContain('/path/to/job');
    expect(r.normalizedUrl).toContain('ref=123');
  });

  it('rejects non-http(s) protocols', () => {
    expect(normalizeJobUrl('file:///tmp/job')).toEqual({ normalizedUrl: null, platformId: 'other' });
  });
});
