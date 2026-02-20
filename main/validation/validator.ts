import type { CallBOutput } from '../../shared/types';
import type { ParsedRules } from './ruleParser';
import { parseRules } from './ruleParser';

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  degraded: boolean;
};

const DEFAULT_STRONG_PER_BULLET_CAP = 2;

/**
 * Approximate sentence count (split on . ! ?).
 */
function sentenceCount(text: string): number {
  if (!text || !text.trim()) return 0;
  const trimmed = text.trim();
  const parts = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  return parts.length;
}

/** Extract inner HTML of each <li>...</li> from experience HTML. */
function getExperienceBullets(html: string): string[] {
  if (!html || typeof html !== 'string') return [];
  const bullets: string[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = liRegex.exec(html)) !== null) {
    bullets.push(m[1]);
  }
  return bullets;
}

/** Count <strong> (and <b>) tags in a fragment. */
function countEmphasized(html: string): number {
  const strong = (html.match(/<strong[^>]*>[\s\S]*?<\/strong>/gi) || []).length;
  const b = (html.match(/<b[^>]*>[\s\S]*?<\/b>/gi) || []).length;
  return strong + b;
}

/**
 * Validate Call B output against parsed rules and schema.
 * Supports rules schema (meta + resume + cover_letter) and legacy (resume_payload + cover_letter_text).
 * Validates: schema, cover letter length, bullet counts from profile/validation_targets, no <strong> in skills, max emphasized per bullet.
 * If questions are provided, validates that QA array exists and is non-empty.
 */
export function validateCallBOutput(
  output: CallBOutput,
  rulesText: string,
  questionsProvided?: boolean
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsed = parseRules(rulesText);
  const degraded = parsed.degraded;

  const coverText = output.cover_letter?.text ?? output.cover_letter_text;
  const ownerFirstName = output.meta?.owner_first_name ?? output.owner_first_name;

  if (typeof coverText !== 'string') {
    errors.push('cover_letter.text or cover_letter_text must be a string');
  }
  if (typeof ownerFirstName !== 'string' || !ownerFirstName.trim()) {
    errors.push('owner_first_name (or meta.owner_first_name) must be a non-empty string');
  }

  if (output.resume == null && (!output.resume_payload || typeof output.resume_payload !== 'object')) {
    errors.push('resume (rules schema) or resume_payload (legacy) must be present');
  }

  // Cover letter: ~4-5 sentences (allow 3-7)
  const coverSentences = sentenceCount(coverText ?? '');
  if (coverSentences < 3) {
    errors.push(`cover letter has too few sentences (${coverSentences}); expected about 4-5`);
  } else if (coverSentences > 10) {
    warnings.push(`cover letter has many sentences (${coverSentences}); typically 4-5`);
  }

  // Rules schema: validate structured resume
  if (output.resume != null) {
    const targets = (output.validation_targets ?? {}) as Record<string, unknown>;
    const bulletCountsPerCompany = (targets.bullet_counts_per_company ?? parsed.bulletCounts) as Record<string, number>;
    const maxEmphasisPerBullet = (targets.max_emphasis_per_bullet as number) ?? parsed.strongPerBulletCap ?? DEFAULT_STRONG_PER_BULLET_CAP;

    if (Array.isArray(output.resume.skills)) {
      for (const row of output.resume.skills) {
        const items = row?.items ?? [];
        for (const item of items) {
          if (typeof item === 'string' && /<strong|<\/strong>|<b[^>]*>|<\/b>/i.test(item)) {
            errors.push('skills must be plain text; no <strong> or <b> tags allowed');
            break;
          }
        }
      }
    }

    if (Array.isArray(output.resume.experience)) {
      for (const company of output.resume.experience) {
        const companyKey = company?.company_key ?? '';
        const expectedBullets = typeof bulletCountsPerCompany[companyKey] === 'number'
          ? bulletCountsPerCompany[companyKey]
          : (Object.keys(bulletCountsPerCompany).length > 0 ? null : null);
        const bullets = company?.bullets ?? [];
        if (expectedBullets != null && bullets.length !== expectedBullets) {
          errors.push(`experience.${companyKey}: expected ${expectedBullets} bullets (found ${bullets.length})`);
        }
        bullets.forEach((b, i) => {
          const terms = b?.emphasized_terms ?? [];
          if (terms.length > maxEmphasisPerBullet) {
            errors.push(`experience.${companyKey} bullet ${i + 1}: at most ${maxEmphasisPerBullet} emphasized terms (found ${terms.length})`);
          }
        });
      }
    }
  }

  // Legacy: resume_payload validation
  if (output.resume_payload != null && typeof output.resume_payload === 'object') {
    const keys = Object.keys(output.resume_payload);
    if (keys.length === 0) warnings.push('resume_payload is empty');

    const skills = output.resume_payload.skills;
    if (skills != null && typeof skills === 'string' && /<strong|<\/strong>|<b[^>]*>|<\/b>/i.test(skills)) {
      errors.push('skills must be plain text; no <strong> or <b> tags allowed');
    }

    const experienceRaw = output.resume_payload.experience;
    const experienceHtml = experienceRaw != null ? (typeof experienceRaw === 'string' ? experienceRaw : String(experienceRaw)) : '';
    const bullets = getExperienceBullets(experienceHtml);

    if (bullets.length > 0) {
      const expectedTotal = Object.keys(parsed.bulletCounts).length > 0
        ? Object.values(parsed.bulletCounts).reduce((a, b) => a + b, 0)
        : null;
      if (expectedTotal != null && bullets.length !== expectedTotal) {
        errors.push(`experience must have ${expectedTotal} bullets per profile rules (found ${bullets.length})`);
      }
      const strongCap = parsed.strongPerBulletCap ?? DEFAULT_STRONG_PER_BULLET_CAP;
      bullets.forEach((bulletHtml, i) => {
        const n = countEmphasized(bulletHtml);
        if (n > strongCap) {
          errors.push(`bullet ${i + 1}: at most ${strongCap} emphasized terms allowed (found ${n})`);
        }
      });
    }
  }

  // Validate QA when questions are provided
  if (questionsProvided) {
    if (!output.qa || !Array.isArray(output.qa) || output.qa.length === 0) {
      errors.push('QA array is required when questions are provided but is missing or empty');
    } else {
      // Validate QA structure
      for (let i = 0; i < output.qa.length; i++) {
        const item = output.qa[i];
        if (!item || typeof item !== 'object') {
          errors.push(`QA item ${i + 1} is invalid (must be an object)`);
        } else {
          if (typeof item.question !== 'string' || !item.question.trim()) {
            errors.push(`QA item ${i + 1} has invalid or empty question`);
          }
          if (typeof item.answer !== 'string' || !item.answer.trim()) {
            errors.push(`QA item ${i + 1} has invalid or empty answer`);
          }
        }
      }
    }
  }

  if (degraded) {
    warnings.push('Rules could not be fully parsed; validation is relaxed');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    degraded,
  };
}

/**
 * Parse rules only (for use when validation is not needed).
 */
export function getParsedRules(rulesText: string): ParsedRules {
  return parseRules(rulesText);
}
