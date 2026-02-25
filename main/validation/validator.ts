import type { CallBOutput } from '../../shared/types';

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  degraded: boolean;
};

/**
 * Approximate sentence count (split on . ! ?).
 */
function sentenceCount(text: string): number {
  if (!text || !text.trim()) return 0;
  const trimmed = text.trim();
  const parts = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  return parts.length;
}

/**
 * Validate Call B output against schema.
 * Supports rules schema (meta + resume + cover_letter) and legacy (resume_payload + cover_letter_text).
 * Validates: schema, cover letter length, basic bullet constraints from validation_targets, no <strong> in skills, max emphasized per bullet.
 * If questions are provided, validates that QA array exists and is non-empty.
 */
export function validateCallBOutput(
  output: CallBOutput,
  questionsProvided?: boolean
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const degraded = false;

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
    const bulletCountsPerCompany = (targets.bullet_counts_per_company ?? {}) as Record<string, number>;

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

    // Do not validate number of emphasized terms per bullet for legacy HTML anymore.
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

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    degraded,
  };
}

/**
 * Legacy no-op for backward compatibility; rules_text is no longer used.
 */
export function getParsedRules(_rulesText: string) {
  return {
    bulletCounts: {},
    skillsCategories: [],
    summaryOpener: null,
    noStrongInSkills: false,
    strongPerBulletCap: null,
    minSkillsCount: null,
    degraded: true,
  };
}
