/**
 * Build system + user prompt for Call A: JD Extraction.
 * Rules are now fixed in code and independent of any per-profile configuration.
 */
export function buildCallAMessages(
  jdText: string,
  jobUrl?: string
): Array<{ role: 'system' | 'user'; content: string }> {
  const systemPrompt = `You are a precise job description parser. Extract structured data from the job description and return ONLY valid JSON, no other text.

Output JSON with this exact structure (use null for missing values):
{
  "company_name": string | null,
  "job_title": string | null,
  "job_type": string | null,
  "budget": string | null,
  "required_tech_stack": string | string[] | null,
  "job_description_clean": string | null,
  "contact": {
    "email": string | null,
    "phone": string | null,
    "follow_up_links": string[] | null,
    "source_text_snippets": string[] | null
  }
}

Rules:
- company_name: Official company name if stated.
- job_title: Exact job title.
- job_type: e.g. Full-time, Contract, etc.
- required_tech_stack: Array of technologies or single string; null if not specified.
- job_description_clean: Condensed, clean version of the JD (2-4 sentences).
- contact.email: Recruiter/hiring contact email if present.
- contact.phone: Contact phone if present.
- contact.follow_up_links: Up to 5 relevant links (apply, career page, etc.); exclude generic social links.
- contact.source_text_snippets: Short quotes from the JD where contact info appeared.

Return only the JSON object.`;

  let userContent = `Job description to parse:\n\n${jdText}`;
  if (jobUrl) {
    userContent += `\n\nOptional source URL (metadata only): ${jobUrl}`;
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];
}
