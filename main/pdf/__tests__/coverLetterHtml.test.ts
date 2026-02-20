import { buildCoverLetterHtml } from '../coverLetterHtml';

describe('buildCoverLetterHtml', () => {
  it('wraps text in valid HTML with paragraph tags', () => {
    const html = buildCoverLetterHtml('Hello world.');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html>');
    expect(html).toContain('<body>');
    expect(html).toContain('<p>');
    expect(html).toContain('Hello world.');
  });

  it('escapes user text safely', () => {
    const html = buildCoverLetterHtml('Use <script>alert(1)</script> & "quotes"');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;quotes&quot;');
  });

  it('splits double newlines into paragraphs', () => {
    const html = buildCoverLetterHtml('Para one.\n\nPara two.');
    expect(html).toContain('<p>');
    expect(html).toContain('Para one.');
    expect(html).toContain('Para two.');
  });
});
