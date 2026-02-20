import { mergeResumeTemplate, getTemplatePlaceholderKeys } from '../templateMerge';

describe('mergeResumeTemplate', () => {
  it('replaces placeholders with payload values', () => {
    const template = '<h1>{{owner_first_name}} Resume</h1><p>{{summary}}</p>';
    const payload = { summary: 'Experienced developer.' };
    const html = mergeResumeTemplate(template, payload, 'Jane');
    expect(html).toContain('Jane Resume');
    expect(html).toContain('Experienced developer.');
  });

  it('uses owner_first_name from argument', () => {
    const template = '{{owner_first_name}}';
    const html = mergeResumeTemplate(template, {}, 'Tan');
    expect(html).toBe('Tan');
  });

  it('replaces missing placeholder with empty string', () => {
    const template = '{{missing}}';
    const html = mergeResumeTemplate(template, {}, 'X');
    expect(html).toBe('');
  });

  it('output contains html and body when template has them', () => {
    const template = '<html><body>{{summary}}</body></html>';
    const html = mergeResumeTemplate(template, { summary: 'Hi' }, 'A');
    expect(html).toContain('<html>');
    expect(html).toContain('</body>');
    expect(html).toContain('Hi');
  });

  it('replaces placeholders with optional spaces {{ key }}', () => {
    const template = '<p>{{ summary }}</p>';
    const html = mergeResumeTemplate(template, { summary: 'Real content' }, 'X');
    expect(html).toContain('Real content');
    expect(html).not.toContain('{{');
  });

  it('resolves placeholders case-insensitively', () => {
    const template = '<p>{{Summary}}</p><p>{{SKILLS}}</p>';
    const html = mergeResumeTemplate(template, { summary: 'My summary', skills: 'Python, Java' }, 'X');
    expect(html).toContain('My summary');
    expect(html).toContain('Python, Java');
  });

  it('getTemplatePlaceholderKeys returns unique keys from template', () => {
    expect(getTemplatePlaceholderKeys('<p>{{summary}}</p>')).toEqual(['summary']);
    expect(getTemplatePlaceholderKeys('<p>{{a}}</p><p>{{b}}</p><p>{{a}}</p>')).toEqual(['a', 'b']);
  });

  it('strips <strong> and <b> from skills so only Summary + Experience keep emphasis', () => {
    const template = '<p>{{skills}}</p>';
    const payload = { skills: 'Python, <strong>React</strong>, <b>AWS</b>, Docker' };
    const html = mergeResumeTemplate(template, payload, 'X');
    expect(html).toContain('Python, React, AWS, Docker');
    expect(html).not.toMatch(/<strong>|<b>|<\/strong>|<\/b>/);
  });
});
