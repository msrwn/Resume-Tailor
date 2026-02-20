import type { CallBResume } from '../../shared/types';

const PLACEHOLDER_REGEX = /\{\{\s*(\w+)\s*\}\}/g;

/**
 * Merge contract for multi-profile: templates use {{key}} placeholders only.
 * No profile-specific literal text. Keys: headline, summary, skills, experience,
 * education, certificates, owner_first_name. Each profile's rules + template define content and layout.
 */

/**
 * Return unique placeholder keys found in template (e.g. ['summary', 'skills']).
 */
export function getTemplatePlaceholderKeys(templateHtml: string): string[] {
  const keys: string[] = [];
  let m: RegExpExecArray | null;
  PLACEHOLDER_REGEX.lastIndex = 0;
  while ((m = PLACEHOLDER_REGEX.exec(templateHtml)) !== null) {
    if (!keys.includes(m[1])) keys.push(m[1]);
  }
  return keys;
}

/** Wrap 2–3 terms in summary text and 1–2 per bullet with <strong>. Only first occurrence of each term. */
function wrapTermsInStrong(text: string, terms: string[] | undefined): string {
  if (!terms?.length) return text;
  let out = text;
  for (const term of terms) {
    const t = term.trim();
    if (!t) continue;
    const idx = out.toLowerCase().indexOf(t.toLowerCase());
    if (idx === -1) continue;
    const before = out.slice(0, idx);
    const match = out.slice(idx, idx + t.length);
    const after = out.slice(idx + t.length);
    out = before + '<strong>' + match + '</strong>' + after;
  }
  return out;
}

/**
 * Build a flat payload (for {{placeholder}} merge) from the rules-schema structured resume.
 * Works with any profile: categories, companies, and counts come from the LLM per profile rules.
 * Summary and experience bullets get <strong> only on emphasized_terms; skills are plain.
 * Uses neutral class "experience-company" so any profile's CSS can style it.
 */
export function buildMergePayloadFromStructuredResume(
  resume: CallBResume,
  ownerFirstName: string
): Record<string, unknown> {
  const summaryHtml =
    resume.summary?.text != null
      ? wrapTermsInStrong(resume.summary.text, resume.summary.emphasized_terms)
      : '';

  const skillsParts: string[] = [];
  if (Array.isArray(resume.skills)) {
    for (const row of resume.skills) {
      const cat = row?.category ?? '';
      const items = Array.isArray(row?.items) ? row.items.filter((i) => typeof i === 'string') : [];
      skillsParts.push(`<li>${cat}: ${items.join(', ')}</li>`);
    }
  }
  const skillsHtml = skillsParts.length ? `<ul>\n${skillsParts.join('\n')}\n</ul>` : '';

  const experienceParts: string[] = [];
  if (Array.isArray(resume.experience)) {
    for (const company of resume.experience) {
      const roleTitle = (company?.role_title ?? '').replace(/^\.\.\.\.\s*/, '');
      const companyName = company?.company_display_name ?? company?.company_key ?? '';
      const location = company?.location ?? '';
      const duration = company?.duration ?? '';
      const locationDuration =
        location && duration ? `${location} | ${duration}` : location || duration;
      experienceParts.push(
        `<h3>${roleTitle}<span class="company-info">${companyName}</span></h3>`
      );
      if (locationDuration) {
        experienceParts.push(`<div>${escapeHtmlText(locationDuration)}</div>`);
      }
      const bullets: string[] = [];
      if (Array.isArray(company.bullets)) {
        for (const b of company.bullets) {
          const bulletText = b?.text ?? '';
          const bulletHtml = wrapTermsInStrong(bulletText, b?.emphasized_terms);
          bullets.push(`<li>${bulletHtml}</li>`);
        }
      }
      experienceParts.push(`<ul>\n${bullets.join('\n')}\n</ul>`);
    }
  }
  const experienceHtml = experienceParts.join('\n');

  const certs = Array.isArray(resume.certificates) ? resume.certificates : [];
  const certificatesHtml =
    certs.length > 0
      ? '<ul>\n' +
        certs
          .map(
            (c) =>
              `<li><a href="${escapeHtmlAttr(c?.url ?? '')}">${escapeHtmlText(c?.title ?? '')}</a></li>`
          )
          .join('\n') +
        '\n</ul>'
      : '';

  const rawHeadline = resume.headline ?? '';
  const headline = rawHeadline.replace(/^\.\.\.\.\s*/, '');

  return {
    owner_first_name: ownerFirstName,
    headline,
    summary: summaryHtml,
    skills: skillsHtml,
    experience: experienceHtml,
    education: resume.education ?? '',
    certificates: certificatesHtml,
  };
}

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Merge profile template_html with resume payload.
 * 1) Section replacements: Skills <ul>, Professional Experience block, Certificates <ul> (so template placeholders like {skill 1}, {Action + How...} get replaced by real content).
 * 2) Literal replacements: "....{headline aligned to JD}", summary placeholder text.
 * 3) {{key}} placeholders (case-insensitive).
 */
export function mergeResumeTemplate(
  templateHtml: string,
  resumePayload: Record<string, unknown>,
  ownerFirstName: string
): string {
  const payload: Record<string, string> = {
    owner_first_name: String(ownerFirstName || ''),
    ...toFlatStrings(resumePayload),
  };
  const payloadByLower: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload)) {
    payloadByLower[k.toLowerCase()] = v;
  }
  const get = (key: string): string => {
    if (payload[key] !== undefined) return payload[key];
    const v = payloadByLower[key.toLowerCase()];
    return v !== undefined ? v : '';
  };

  let out = templateHtml;
  const headline = get('headline');
  const summary = get('summary');
  const skillsHtml = get('skills');
  const experienceHtml = get('experience');
  const certificatesHtml = get('certificates');

  // 1) Section replacements: insert Skills, Experience, Certificates (always replace so placeholder content is gone)
  out = out.replace(
    /(<h2[^>]*>\s*Skills\s*<\/h2>\s*)<ul>[\s\S]*?<\/ul>/i,
    (_, prefix) => prefix + skillsHtml
  );
  out = out.replace(
    /(<h2[^>]*>\s*Professional Experience\s*<\/h2>\s*)[\s\S]*?(?=<h2[^>]*>\s*Education\s*<\/h2>)/i,
    (_, prefix) => prefix + experienceHtml
  );
  out = out.replace(
    /(<h2[^>]*>\s*Certificates\s*<\/h2>\s*)<ul>[\s\S]*?<\/ul>/i,
    (_, prefix) => prefix + certificatesHtml
  );

  // 2) Literal placeholders: replace including leading "...." so no dots remain
  out = out.replace(/\.\.\.\.\s*\{headline[^}]*\}/gi, headline);
  out = out.replace(/\{headline[^}]*\}/gi, headline);
  out = out.replace(/\.\.\.\.\s*\{single-paragraph[\s\S]*?<\/strong>\s*\}/gi, summary);
  out = out.replace(/\.\.\.\.\s*\{single-paragraph\s+summary[^}]*\}/gi, summary);
  out = out.replace(/\{role\s*title[^}]*\}/gi, '');

  // 3) {{key}} placeholders
  PLACEHOLDER_REGEX.lastIndex = 0;
  out = out.replace(PLACEHOLDER_REGEX, (_, key) => get(key));

  return out;
}

/** Strip <strong>/<b> so only Summary + Experience bullets keep emphasis; skills must be plain. */
function stripStrongFromSkills(value: string): string {
  if (!value || typeof value !== 'string') return value;
  return value
    .replace(/<\/?strong[^>]*>/gi, '')
    .replace(/<\/?b\b[^>]*>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toFlatStrings(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    let s: string;
    if (v == null) {
      s = '';
    } else if (typeof v === 'string') {
      s = v;
    } else if (Array.isArray(v)) {
      s = v.map((x) => (typeof x === 'string' ? x : String(x))).join('\n');
    } else if (typeof v === 'object') {
      s = JSON.stringify(v);
    } else {
      s = String(v);
    }
    if (k.toLowerCase() === 'skills') {
      s = stripStrongFromSkills(s);
    }
    out[k] = s;
  }
  return out;
}
