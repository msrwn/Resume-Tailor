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

/** Exact JSON output format for Call B. Model returns this structure so we do not need to inject/look up from base resume. */
const CALL_B_OUTPUT_FORMAT = `
OUTPUT RESULT IN THE SAME FORMAT AS FOLLOWING JSON PAYLOAD
{
  "meta": {
    "owner_first_name": "Tan",
    "owner_full_name": "Tan Tran",
    "company_name": "Acme Corp",
    "job_title": "Senior Mobile Engineer",
    "role_display": "Senior Mobile Engineer (React Native)",
    "normalized_company_slug": "acme-corp",
    "normalized_role_slug": "senior-mobile-engineer",
    "contact_email": "name@example.com",
    "contact_phone": "+1-555-123-4567",
    "contact_github": "github.com/username",
    "contact_address": "New York, NY, USA",
    "contact_linkedin": "linkedin.com/in/username",
    "contact_website": "https://username.dev"
  },
  "resume": {
    "headline": "Senior Mobile Engineer – React Native, TypeScript, Firebase",
    "summary": {
      "text": "Senior mobile engineer with 8+ years owning React Native apps end-to-end, shipping high quality features that improve stability, performance, and release velocity.",
      "emphasized_terms": ["React Native", "TypeScript", "release velocity", "stability"]
    },
    "skills": [
      { "category": "Languages & Core", "items": ["TypeScript", "JavaScript (ES2020+)", "Kotlin", "Java", "Dart"] },
      { "category": "Mobile Frameworks", "items": ["React Native", "Flutter", "Android (native)"] },
      { "category": "Backend & Infra", "items": ["Node.js", "PostgreSQL", "Firebase", "Cloud Functions", "REST APIs"] }
    ],
    "languages": [
      { "name": "English", "proficiency": "Native or Bilingual" },
      { "name": "Italian", "proficiency": "Native or Bilingual" }
    ],
    "experience": [
      {
        "company_key": "matto_espresso",
        "company_display_name": "Matto Espresso",
        "role_title": "Senior React Native Engineer",
        "location": "New York, NY (Remote)",
        "duration": "2022 – Present",
        "bullets": [
          { "text": "Owned the React Native codebase for the Matto ordering app, leading feature delivery across iOS and Android while collaborating with design and product.", "emphasized_terms": ["React Native", "owned", "iOS and Android"] }
        ]
      }
    ],
    "freelance_projects": [
      {
        "role_title": "Fullstack Developer (Freelance)",
        "client_name": "e_tell",
        "project_name": "MERN Education Platform",
        "project_description": "Led architecture and development of MERN stack education platform with Expo SDK mobile apps.",
        "location": "Remote",
        "duration": "2023 – Present",
        "tech_stack": ["React", "Node.js", "Express", "MongoDB", "Expo"],
        "bullets": [
          { "text": "Implemented secure authentication and role-based permissions for students and admins.", "emphasized_terms": ["secure authentication", "role-based permissions"] },
          { "text": "Built reusable React components with Material UI and background file uploads.", "emphasized_terms": ["reusable React components", "Material UI"] }
        ]
      }
    ],
    "certificates": [
      { "title": "freeCodeCamp — JavaScript Certification", "url": "https://www.freecodecamp.org/certification/thaitan_tran/javascript-v9" }
    ],
    "education": [
      { "institution": "State University", "degree": "B.S. in Computer Science", "location": "Hanoi, Vietnam", "dates": "2012 – 2016", "notes": "Graduated with honors" }
    ]
  },
  "cover_letter": { "text": "Dear Hiring Manager, ..." },
  "qa": [
    { "question": "How have you used React Native at scale?", "answer": "..." }
  ]
}
`;

/**
 * Build messages for Call B: Resume + Cover Letter.
 * The model returns the full JSON in the format above (meta + resume + cover_letter + qa).
 * No injection or lookup from base resume is needed—contact, identity, and content come from the output.
 */
export function buildCallBMessages(
  jdText: string,
  callA: CallAOutput,
  baseResumeText?: string,
  promptText?: string,
  questions?: string[]
): Array<{ role: 'system' | 'user'; content: string }> {
  const systemPrompt = `You are a resume writer. Return ONLY a single valid JSON object—no markdown, no code fences, no commentary. Use exactly the JSON structure provided (meta, resume, cover_letter, qa).`;

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
      ? `\nQuestions to answer:\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n`
      : '';

  const profilePromptSection =
    promptText && promptText.trim().length > 0
      ? `PROFILE PROMPT (instructions for tailoring):\n\n${promptText.trim()}\n\n---\n`
      : '';

  const baseResumeSection =
    baseResumeText && baseResumeText.trim().length > 0
      ? `BASE RESUME (plain text, source of truth; do NOT change facts, only reframe/tailor):\n\n${baseResumeText.trim()}\n\n---\n`
      : '';

  const callBRules = `You are a Senior Technical Recruiter and Resume Strategist.

GOAL
Generate:
1) A tailored, ATS-optimized resume
2) A concise 4–5 sentence cover letter

Objective: maximize interview chances by making the candidate look like the obvious hire through 
(a) explicit REQUIRED TECH STACK match, 
(b) mission/domain alignment
(c) senior-level ownership + measurable impact.

INPUT
- Job Description (JD) will be provided
- Base resume is already known (DO NOT ask for it)

CORE STRATEGY (LINKED)
1) MIRROR SUMMARY (TOP 3–4 LINES)
Write the Summary to mirror the JD's #1 needs with proof:
- Role identity + years
- Domain/mission alignment (use the company's language)
- Top 2–3 outcomes (performance, reliability, payments, growth, release velocity, etc.)
- Credibility signal (scale/quality: high traffic, stability, crash-free, latency, revenue impact—only if defensible)

2) EVIDENCE BULLETS (NO RESPONSIBILITY LISTS)
Every bullet must be evidence:
Action verb + what you built + tech + impact + scale
- Impact preferred (%, time, reliability, release cadence); if no numbers, use credible proxies (reduced incidents, fewer support tickets, improved responsiveness).
- Avoid vague phrasing ("worked on / helped / involved"); use "owned / led / designed / delivered."

STRICT RULES
A) TECH STACK MATCHING (CRITICAL)
- REQUIRED TECH must appear:
  a) Skills section
  b) MULTIPLE bullets across experience/projects (not just one)
- If missing, bridge via adjacent experience but keep it explainable.
- Do NOT keep generic bullets without tech.
- DO NOT include Required Stack section

B) PRIORITY SWAP (MATCH THEIR PRIORITIES)
Reorder emphasis so the first 6 bullets reflect the JD's top requirements.

C) ROLE PRIORITIZATION
Keep ALL roles (never remove anything)
Enrich ALL roles with meaningful, tech-focused bullets
Distribute JD requirements smartly:
Don't force everything into Matto/Pizza Hut
Use GlassEgg + CMN to cover gaps when needed
Follow credibility:
- Put each tech where it makes the most sense
- No unrealistic stacking

D) CONTROLLED ENRICHMENT
You may add/reframe bullets to align with the JD, but they must be:
- Realistic, explainable, defensible
- No fake tools, no exaggerated scale

E) FEATURE AUTHENTICITY (CRITICAL)
Never stack tools unrealistically per role:
For example:
- Push notifications: ONE (FCM OR OneSignal)
- A/B testing: ONE (Firebase OR LaunchDarkly)
Keep clean, realistic, defensible.

F) PROJECT SELECTION (CRITICAL)
Always include relevant freelance/client projects that match the JD.
Examples:
- Streaming → EmLife
- Health → Wondr Health, EmLife
- Location-based social → Tellascape
- Food/ordering → Matto features
- Chats → Qminds 
- Location Discovery App → Pattaya Night Life
- Education Platform → E-Tell
- Fitness/Nutrition → Shift, G-plan

Do NOT remove strong relevant projects.
Do NOT include Matto in Projects section.

G) BULLET DEPTH
- Each role: 6–10 bullets
- Each project: 2–4 bullets, heavily focused on tech
No fluff, no underwriting, no duplication.

CONSTRAINTS
- DO NOT remove relevant projects
- DO NOT omit used technologies
- DO NOT hallucinate tools
- DO NOT duplicate content
- DO NOT change formatting
- Location format must remain correct

SELF-VALIDATION (SILENT LOOP)
Before output, ensure:
[ ] Required tech appears in Skills
[ ] Required tech appears in MULTIPLE bullets
[ ] Mirror Summary matches role + domain + outcomes + credibility
[ ] Top 1/3 contains heatmap (Skills + Highlights + signature story when relevant)
[ ] Bullets follow evidence formula (action + build + tech + impact + scale)
[ ] Senior-level ownership signals present in each prioritized role
[ ] No unrealistic tool stacking
[ ] Relevant projects included (not removed)
[ ] No missing important JD requirement
If any check fails: silently rewrite and re-validate until all pass.
`;

  const userContent = `${profilePromptSection}${baseResumeSection}${callBRules}
${CALL_B_OUTPUT_FORMAT}

---
INPUTS

Job (from Call A extraction):
${JSON.stringify(jobInput, null, 2)}

Raw job description (excerpt):
${jdText.substring(0, 8000)}${questionsSection}

---
Generate the JSON output now. Return only the JSON object in the exact format above (meta, resume with experience and freelance_projects, cover_letter, qa if questions were provided).`;
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];
}
