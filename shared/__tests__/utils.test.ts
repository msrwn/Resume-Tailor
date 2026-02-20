import { sanitizePathSegment, formatDateFolder, sha256, hashShort } from '../utils';

describe('sanitizePathSegment', () => {
  it('removes illegal characters', () => {
    expect(sanitizePathSegment('test/file:name')).toBe('test_file_name');
    expect(sanitizePathSegment('test*name?')).toBe('test_name');
  });

  it('trims whitespace', () => {
    expect(sanitizePathSegment('  test  ')).toBe('test');
  });

  it('collapses multiple underscores', () => {
    expect(sanitizePathSegment('test___name')).toBe('test_name');
  });

  it('enforces max length', () => {
    const long = 'a'.repeat(100);
    const result = sanitizePathSegment(long, 10);
    expect(result.length).toBe(10);
  });

  it('handles empty input', () => {
    expect(sanitizePathSegment('')).toBe('');
  });
});

describe('formatDateFolder', () => {
  it('formats date as YYYY_MM_DD', () => {
    const date = new Date('2026-02-12T00:00:00Z');
    const result = formatDateFolder(date);
    // Note: This test may need adjustment based on timezone handling
    expect(result).toMatch(/^\d{4}_\d{2}_\d{2}$/);
  });

  it('uses current date by default', () => {
    const result = formatDateFolder();
    expect(result).toMatch(/^\d{4}_\d{2}_\d{2}$/);
  });
});

describe('sha256', () => {
  it('computes SHA-256 hash', () => {
    const result = sha256('test');
    expect(result).toBe('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
  });

  it('produces consistent hashes', () => {
    const result1 = sha256('test');
    const result2 = sha256('test');
    expect(result1).toBe(result2);
  });
});

describe('hashShort', () => {
  it('returns first N characters', () => {
    const hash = 'abcdef1234567890';
    expect(hashShort(hash, 4)).toBe('abcd');
    expect(hashShort(hash, 8)).toBe('abcdef12');
  });

  it('defaults to 8 characters', () => {
    const hash = 'abcdef1234567890';
    expect(hashShort(hash)).toBe('abcdef12');
  });
});
