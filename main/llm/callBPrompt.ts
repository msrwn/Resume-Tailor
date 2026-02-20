import type { CallAOutput } from '../../shared/types';

/** Detect if text looks like placeholder (e.g. {skill 1}, {keyword}, {Action How...) */
export function hasPlaceholderLikeContent(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return (
    /\{[^{}]+\}/.test(text) ||
    /\{skill\s*\d/i.test(text) ||
    /\{keyword\}/i.test(text) ||
    /\{Action\s+How/i.test(text) ||
    /\{single-paragraph/i.test(text) ||
    /\{Result\s+using/i.test(text)
  );
}

/** Recursively check if any string in a value has placeholder-like content */
function valueHasPlaceholders(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === 'string') return hasPlaceholderLikeContent(v);
  if (Array.isArray(v)) return v.some((item) => valueHasPlaceholders(item));
  if (typeof v === 'object') return Object.values(v).some((val) => valueHasPlaceholders(val));
  return false;
}

/** Return true if resume_payload contains any placeholder-like values (including nested) */
export function resumePayloadHasPlaceholders(payload: Record<string, unknown>): boolean {
  return Object.values(payload).some((v) => valueHasPlaceholders(v));
}

/** Extract {{key}} placeholder names from template HTML (excluding owner_first_name). */
export function getTemplatePayloadKeys(templateHtml: string): string[] {
  const keys = new Set<string>();
  const re = /\{\{(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(templateHtml)) !== null) {
    if (m[1] !== 'owner_first_name') keys.add(m[1]);
  }
  return Array.from(keys);
}

/**
 * Build messages for Call B: Resume + Cover Letter.
 * The profile rules_text IS the prompt (schema, constraints, and instructions). We only add:
 * - A short system line: output JSON only.
 * - The job inputs (Call A extraction + raw JD) so the model can generate the JSON.
 * - Optional questions to answer (when provided).
 * No hardcoded field map or system prompt—the rules document defines everything.
 */
export function buildCallBMessages(
  jdText: string,
  rulesText: string,
  callA: CallAOutput,
  _templateHtml?: string,
  questions?: string[]
): Array<{ role: 'system' | 'user'; content: string }> {
  const systemPrompt = `You are a resume writer. Return ONLY a single valid JSON object—no markdown, no code fences, no commentary. Follow exactly the schema and rules provided in the user message.`;

  const jobInput = {
    company_name: callA.company_name ?? 'not_specified',
    job_title: callA.job_title ?? 'not_specified',
    job_type: callA.job_type ?? null,
    budget: callA.budget ?? null,
    required_tech_stack: callA.required_tech_stack ?? null,
    job_description_clean: callA.job_description_clean ?? null,
    contact: callA.contact ?? {},
  };

  const questionsSection =
    questions && questions.length > 0
      ? `
    Questions to answer:
    ${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
    `
      : '';

  const userContent = `
    ${rulesText}

    ---
    INPUTS (use these to generate the JSON output)

    Job (from Call A extraction):
    ${JSON.stringify(jobInput, null, 2)}

    Raw job description (excerpt):
    ${jdText.substring(0, 8000)}${questionsSection}

    ---
    Generate the JSON output now. Return only the JSON object. Use the exact schema and keys defined in the rules above (this may be meta/resume/cover_letter/qa/validation_targets or another structure per profile).
  `;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];
}
