import type { CallBResume, CallBEducationEntry, CallBFreelanceProject } from '../../shared/types';

const PLACEHOLDER_REGEX = /\{\{\s*(\w+)\s*\}\}/g;

/** Template placeholder -> payload key. Enables {phone number} -> contact_phone etc. */
const PLACEHOLDER_ALIASES: Record<string, string> = {
  'phone number': 'contact_phone',
  email: 'contact_email',
  github: 'contact_github',
  address: 'contact_address',
  'full name': 'owner_full_name',
  full_name: 'owner_full_name',
  'first name': 'owner_first_name',
  first_name: 'owner_first_name',
};

/**
 * Merge contract: templates use {{key}} or {key} placeholders.
 * Keys can be top-level (headline, summary, experience, freelancing, education, certificates)
 * or flattened JSON paths (experience_0_role_title, freelance_projects_0_client_name, etc.).
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

  const primaryExperienceParts: string[] = [];
  const freelancingParts: string[] = [];

  const buildExperienceBlock = (company: {
    role_title?: string;
    company_display_name?: string;
    company_key?: string;
    location?: string;
    duration?: string;
    bullets?: Array<{ text?: string; emphasized_terms?: string[] }>;
  }, asFreelance: boolean): void => {
    const roleTitle = (company?.role_title ?? '').replace(/^\.\.\.\.\s*/, '');
    const companyName = company?.company_display_name ?? company?.company_key ?? '';
    const location = company?.location ?? '';
    const duration = company?.duration ?? '';
    const locationDuration =
      location && duration ? `${location} | ${duration}` : location || duration;

    if (asFreelance) {
      const headerLabel = [roleTitle, companyName].filter(Boolean).join(' @');
      freelancingParts.push(
        `<div><span class="project-name">${escapeHtmlText(headerLabel)}</span></div>`
      );
      if (locationDuration) {
        freelancingParts.push(`<div>${escapeHtmlText(locationDuration)}</div>`);
      }
    } else {
      primaryExperienceParts.push(
        `<h3>${roleTitle}<span class="company-info">${companyName}</span></h3>`
      );
      if (locationDuration) {
        primaryExperienceParts.push(`<div>${escapeHtmlText(locationDuration)}</div>`);
      }
    }

    const bullets: string[] = [];
    if (Array.isArray(company.bullets)) {
      for (const b of company.bullets) {
        const bulletText = b?.text ?? '';
        const bulletHtml = wrapTermsInStrong(bulletText, b?.emphasized_terms);
        bullets.push(`<li>${bulletHtml}</li>`);
      }
    }
    if (bullets.length) {
      const block = `<ul>\n${bullets.join('\n')}\n</ul>`;
      if (asFreelance) {
        freelancingParts.push(block);
      } else {
        primaryExperienceParts.push(block);
      }
    }
  };

  const isFreelanceEntry = (company: { role_title?: string; duration?: string }): boolean => {
    const title = (company?.role_title ?? '').toLowerCase();
    const duration = (company?.duration ?? '').trim();
    if (title.includes('freelance') || title.includes('contract') || title.includes('consultant')) {
      return true;
    }
    if (duration && !/[–-]/.test(duration) && /^\d{4}$/.test(duration)) return true;
    return false;
  };

  // Freelancing section: prefer dedicated freelance_projects from output; else derive from experience
  // Format: <div><span class="project-name">{client_name}</span> - {project_name}</div><ul>...</ul>
  if (Array.isArray(resume.freelance_projects) && resume.freelance_projects.length > 0) {
    for (const proj of resume.freelance_projects as CallBFreelanceProject[]) {
      const clientLabel = proj.client_name ?? proj.project_name ?? '';
      const projectLabel =
        proj.client_name && proj.project_name ? proj.project_name : '';
      const clientHtml = escapeHtmlText(clientLabel);
      const projectHtml = escapeHtmlText(projectLabel);
      const sep = projectHtml ? ' - ' : '';
      freelancingParts.push(
        `<div><span class="project-name">${clientHtml}</span>${sep}${projectHtml}</div>`
      );
      const projBullets: string[] = [];
      if (Array.isArray(proj.bullets)) {
        for (const b of proj.bullets) {
          const bulletHtml = wrapTermsInStrong(b?.text ?? '', b?.emphasized_terms);
          projBullets.push(`<li>${bulletHtml}</li>`);
        }
      }
      if (projBullets.length) freelancingParts.push(`<ul>\n${projBullets.join('\n')}\n</ul>`);
    }
  }

  // Primary experience: always from resume.experience (non-freelance only when not using freelance_projects)
  if (Array.isArray(resume.experience)) {
    for (const company of resume.experience) {
      const asFreelance =
        !(Array.isArray(resume.freelance_projects) && resume.freelance_projects.length > 0) &&
        isFreelanceEntry(company);
      buildExperienceBlock(company, asFreelance);
    }
  }

  const experienceHtml = primaryExperienceParts.join('\n');
  const freelancingHtml = freelancingParts.join('\n');

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

  // Education: flatten structured entries into a simple text block for {education} placeholder.
  const toEducationLine = (e: CallBEducationEntry): string => {
    const parts: string[] = [];
    if (e.degree) parts.push(escapeHtmlText(e.degree));
    if (e.institution) parts.push(escapeHtmlText(e.institution));
    const tail: string[] = [];
    if (e.location) tail.push(escapeHtmlText(e.location));
    if (e.dates) tail.push(escapeHtmlText(e.dates));
    if (tail.length) parts.push(tail.join(' | '));
    if (e.notes) parts.push(escapeHtmlText(e.notes));
    return parts.join(' — ');
  };

  let educationText = '';
  if (Array.isArray(resume.education)) {
    const lines = (resume.education as CallBEducationEntry[])
      .map((e) => (e ? toEducationLine(e) : ''))
      .filter((line) => line.trim().length > 0);
    educationText = lines.join('\n');
  } else if (typeof resume.education === 'string') {
    // Backward-compatibility for any legacy payloads that still send a single string.
    educationText = resume.education;
  }

  const flattened = flattenResumeToPayload(resume);
  const payload: Record<string, unknown> = {
    ...flattened,
    owner_first_name: ownerFirstName,
    headline,
    summary: summaryHtml,
    skills: skillsHtml,
    experience: experienceHtml,
    freelancing: freelancingHtml,
    education: educationText,
    certificates: certificatesHtml,
  };
  return payload;
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
 * Flatten a resume-like object into a key-value map so any JSON path can be used as a placeholder.
 * Arrays of objects get indexed keys: experience_0_role_title, freelance_projects_0_client_name.
 * Arrays of primitives are joined into a single string; objects are recursively flattened.
 */
function flattenResumeToPayload(obj: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (obj == null) {
    if (prefix) out[prefix] = '';
    return out;
  }
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    if (prefix) out[prefix] = String(obj);
    return out;
  }
  if (Array.isArray(obj)) {
    const isObjectArray = obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null && !Array.isArray(obj[0]);
    if (isObjectArray) {
      obj.forEach((item, i) => {
        const next = flattenResumeToPayload(item, prefix ? `${prefix}_${i}` : String(i));
        Object.assign(out, next);
      });
    } else {
      const joined = obj.map((x) => (typeof x === 'string' ? x : String(x))).join(', ');
      if (prefix) out[prefix] = joined;
    }
    return out;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}_${k}` : k;
      if (v != null && typeof v === 'object' && !Array.isArray(v)) {
        const hasScalarChildren =
          typeof (v as Record<string, unknown>).text === 'string' ||
          typeof (v as Record<string, unknown>).title === 'string';
        if (hasScalarChildren) {
          const nested = flattenResumeToPayload(v, key);
          Object.assign(out, nested);
        } else {
          const nested = flattenResumeToPayload(v, key);
          Object.assign(out, nested);
        }
      } else {
        const nested = flattenResumeToPayload(v, key);
        Object.assign(out, nested);
      }
    }
    return out;
  }
  return out;
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
  const flat = toFlatStrings(
    resumePayload && typeof resumePayload === 'object' ? resumePayload : {}
  );
  const payload: Record<string, string> = {
    owner_first_name: String(ownerFirstName || ''),
    ...flat,
  };
  const payloadByLower: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload)) {
    payloadByLower[k.toLowerCase()] = v;
  }
  const resolveKey = (templateKey: string): string =>
    PLACEHOLDER_ALIASES[templateKey.trim()] ?? templateKey.trim();
  const get = (key: string): string => {
    const k = resolveKey(key);
    if (payload[k] !== undefined) return payload[k];
    const v = payloadByLower[k.toLowerCase()];
    return v !== undefined ? v : '';
  };

  let out = templateHtml;
  const headline = get('headline');
  const summary = get('summary');
  const skillsHtml = get('skills');
  const experienceHtml = get('experience');
  const certificatesHtml = get('certificates');
  const freelancingHtml = get('freelancing');

  // 1) Section replacements: insert Skills, Experience, Certificates (always replace so placeholder content is gone)
  out = out.replace(
    /(<h2[^>]*>\s*Skills\s*<\/h2>\s*)<ul>[\s\S]*?<\/ul>/i,
    (_, prefix) => prefix + skillsHtml
  );
  out = out.replace(
    /(<h2[^>]*>\s*Professional Experience\s*<\/h2>\s*)[\s\S]*?(?=<h2[^>]*>\s*(?:Education|Freelancing\s*&\s*Client\s*Projects)\s*<\/h2>)/i,
    (_, prefix) => prefix + experienceHtml
  );
  out = out.replace(
    /(<h2[^>]*>\s*Freelancing\s*&\s*Client\s*Projects\s*<\/h2>\s*)[\s\S]*?(?=<h2[^>]*>\s*Education\s*<\/h2>)/i,
    (_, prefix) => (freelancingHtml ? prefix + freelancingHtml : prefix)
  );
  out = out.replace(
    /(<h2[^>]*>\s*Certificates\s*<\/h2>\s*)<ul>[\s\S]*?<\/ul>/i,
    (_, prefix) => prefix + certificatesHtml
  );

  // 2) {{key}} and {key} placeholders first (so "{{summary}}" is resolved from payload, not literal {summary})
  out = out.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => get(key));
  // Single-brace: only match simple placeholder tokens (letters/digits/underscore/space) so CSS blocks stay intact
  out = out.replace(/\{\s*([a-zA-Z0-9_ ]+)\s*\}/g, (_, key) => {
    const normalized = key.trim().replace(/^[\s{]+|[\s}]+$/g, '');
    return normalized ? get(normalized) : '';
  });

  // 3) Literal placeholders: legacy patterns that include extra text inside braces
  out = out.replace(/\.\.\.\.\s*\{headline[^}]*\}/gi, headline);
  out = out.replace(/\{headline[^}]*\}/gi, headline);
  out = out.replace(/\.\.\.\.\s*\{single-paragraph[\s\S]*?<\/strong>\s*\}/gi, summary);
  out = out.replace(/\.\.\.\.\s*\{single-paragraph\s+summary[^}]*\}/gi, summary);
  const ownerFullName = get('owner_full_name') || get('full_name');
  if (ownerFullName) {
    out = out.replace(/\{full name\}/gi, ownerFullName);
    out = out.replace(/\{full_name\}/gi, ownerFullName);
  }
  const ownerFirstNameText = get('owner_first_name');
  if (ownerFirstNameText) {
    out = out.replace(/\{first name\}/gi, ownerFirstNameText);
    out = out.replace(/\{first_name\}/gi, ownerFirstNameText);
  }
  const titleText = get('headline') || get('role_display') || get('job_title') || '';
  if (titleText) {
    out = out.replace(/\{title\}/gi, titleText);
  }
  out = out.replace(/\{role\s*title[^}]*\}/gi, '');

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
