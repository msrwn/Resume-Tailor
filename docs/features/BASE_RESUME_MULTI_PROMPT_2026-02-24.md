# Base Resume + Multi-Prompt Refactor (Breaking Change)

**Status**: ✅ Completed  
**Created**: 2026-02-24  
**Version**: 1.0.0  

---

## 1. Overview

This feature changes how Resume Tailor generates tailored resumes:

- **Before**: Call B used only the selected Profile’s `rules_text` and JD (plus Call A extraction). The “source of truth” for the candidate lived mostly inside the prompt.
- **Now**: Each Profile has a **Base Resume (plain text)** and **one or more role-focused Prompts**. For every JD, Call B receives:
  - Base resume text (per profile)
  - Selected prompt text (optional, per run)
  - Profile rules
  - JD text + Call A extraction
  - Optional questions

The LLM still returns a strict JSON object with `meta`, `resume`, `cover_letter`, and optional `qa`, but the content is now grounded in the stored base resume instead of being implicitly reconstructed each time.

This is a **breaking change** because:

- The DB schema was extended (`base_resume_text` column on `profiles` and a new `profile_prompts` table).
- Profile create/update flows now include `base_resume_text`.
- Call B input contract changed to always include base resume and to optionally include a selected prompt.

---

## 2. Behaviour Changes

### 2.1 Base Resume as Source of Truth

- Each Profile owns a single `base_resume_text` (plain text).
- This text is treated as the canonical resume the user would paste into ChatGPT in real-world usage.
- The app and the model **never edit** this field; all tailoring happens in generated output only.

### 2.2 Multiple Prompts per Profile

- Each Profile can have multiple prompts stored in `profile_prompts`:
  - `name` (e.g. “Mobile-focused”, “Web platform”)
  - `prompt_text` (full instructions)
- Prompts are attached to a specific profile; they are not global.
- For this release:
  - **Single-profile runs** can use an optional selected prompt.
  - **Multi-profile runs** do not yet select prompts per profile (they use base resume + rules only).

### 2.3 Call B Inputs

For each profile/JD pair, Call B now receives (in order):

1. **Profile Prompt** (if selected):
   - A section titled “PROFILE PROMPT (instructions for tailoring)” containing the chosen prompt text.
2. **Base Resume**:
   - A section titled “BASE RESUME (plain text, source of truth; do NOT change facts, only reframe/tailor)”.
3. **Profile Rules**:
   - Existing `rules_text` (schema + constraints).
4. **INPUTS**:
   - Call A extraction (company, title, tech stack, contact info, etc.).
   - Raw JD excerpt (clipped).
   - Questions (if any), listed and numbered.

The system prompt continues to enforce “JSON-only” output.

### 2.4 Call B Output (JSON Contract – FINAL)

Call B always returns a single JSON object with this shape. This is the **only supported format for new generations** (legacy `resume_payload` is read-only for old rows):

```json
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
    "contact_address": "New York, NY, USA"
  },
  "resume": {
    "headline": "Senior Mobile Engineer – React Native, TypeScript, Firebase",
    "summary": {
      "text": "Senior mobile engineer with 8+ years owning React Native apps end-to-end, shipping high quality features that improve stability, performance, and release velocity.",
      "emphasized_terms": [
        "React Native",
        "TypeScript",
        "release velocity",
        "stability"
      ]
    },
    "skills": [
      {
        "category": "Languages & Core",
        "items": ["TypeScript", "JavaScript (ES2020+)", "Kotlin", "Java", "Dart"]
      },
      {
        "category": "Mobile Frameworks",
        "items": ["React Native", "Flutter", "Android (native)"]
      },
      {
        "category": "Backend & Infra",
        "items": ["Node.js", "PostgreSQL", "Firebase", "Cloud Functions", "REST APIs"]
      }
    ],
    "experience": [
      {
        "company_key": "matto_espresso",
        "company_display_name": "Matto Espresso",
        "role_title": "Senior React Native Engineer",
        "location": "New York, NY (Remote)",
        "duration": "2022 – Present",
        "bullets": [
          {
            "text": "Owned the React Native codebase for the Matto ordering app, leading feature delivery across iOS and Android while collaborating with design and product.",
            "emphasized_terms": ["React Native", "owned", "iOS and Android"]
          }
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
          {
            "text": "Implemented secure authentication and role-based permissions for students and admins.",
            "emphasized_terms": ["secure authentication", "role-based permissions"]
          },
          {
            "text": "Built reusable React components with Material UI and background file uploads.",
            "emphasized_terms": ["reusable React components", "Material UI"]
          }
        ]
      }
    ],
    "certificates": [
      {
        "title": "freeCodeCamp — JavaScript Certification",
        "url": "https://www.freecodecamp.org/certification/thaitan_tran/javascript-v9"
      }
    ],
    "education": [
      {
        "institution": "State University",
        "degree": "B.S. in Computer Science",
        "location": "Hanoi, Vietnam",
        "dates": "2012 – 2016",
        "notes": "Graduated with honors"
      }
    ]
  },
  "cover_letter": {
    "text": "Dear Hiring Manager, ..."
  },
  "qa": [
    {
      "question": "How have you used React Native at scale?",
      "answer": "..."
    }
  ]
}
```

Notes:

- **Education is an array** of entries; the merge layer flattens it into a single `{education}` text block for the template.
- Certificates, skills, and experience are **always arrays**; no mixed string/HTML payloads.
- `cover_letter.text` is the canonical cover letter; `cover_letter_text` on `CallBOutput` exists only as a convenience field for the rest of the app.

### 2.5 Template Merge

- `buildMergePayloadFromStructuredResume(resume, ownerFirstName)` still:
  - Builds `<ul>` blocks for **Skills** and **Certificates**.
  - Builds `<h3> + <div> + <ul>` blocks for **Professional Experience**.
  - Applies `<strong>` only to selected terms in summary/experience, not in skills.
- `mergeResumeTemplate(template_html, payload, ownerFirstName)`:
  - Replaces the Skills `<ul>`, Professional Experience block, and Certificates `<ul>` in the HTML template.
  - Uses an updated regex for **Professional Experience** so it stops before either **Education** or **Freelancing & Client Projects**, preserving that section in your new template.

---

## 3. UX Changes

### 3.1 Profiles Screen

The Profiles editor now has four tabs:

- **Rules**: same as before (`rules_text`).
- **Base Resume**: new tab with a large textarea for the full base resume (plain text).
- **Resume Template**: same HTML template editor.
- **Prompts**: new tab to manage prompts for the selected profile:
  - List existing prompts with name and updated date.
  - Create new prompt (name + prompt_text).
  - Edit existing prompts.
  - Archive prompts (soft delete).

### 3.2 Generate Screen

- **Profiles**:
  - Checkbox list (multi-profile) is unchanged.
  - Selection is still persisted in localStorage.
- **Prompt selection (MVP)**:
  - When exactly **one profile** is selected, the app loads prompts for that profile.
  - If that profile has prompts, a **Prompt dropdown** appears:
    - First option: “(Use profile rules + base resume only)”.
    - Subsequent options: the profile’s prompts by name.
  - The selected `promptId` is sent to the main process and resolved to `promptText` for Call B.
- **Questions + QA**:
  - Input, parsing, Call B integration, and QA PDF behaviour are unchanged.

---

## 4. Technical Changes

### 4.1 Database & Migrations

- **Migration 3** (`user_version = 3`):
  - `ALTER TABLE profiles ADD COLUMN base_resume_text TEXT NOT NULL DEFAULT ''`.
  - Creates `profile_prompts` table with:
    - `prompt_id` (TEXT PK)
    - `profile_id` (TEXT FK → profiles.profile_id)
    - `name` (TEXT NOT NULL)
    - `prompt_text` (TEXT NOT NULL)
    - `created_at`, `updated_at`, `archived_at`
  - Adds index `idx_prompts_profile_id`.

### 4.2 Shared Types & DAOs

- `Profile` now includes `base_resume_text: string`.
- New `ProfilePrompt` type in `shared/types.ts`.
- `profilesDao`:
  - `createProfile` and `updateProfile` write/read `base_resume_text`.
- New `profilePromptsDao` with:
  - `listPromptsForProfile(profileId)`,
  - `getPrompt(promptId)`,
  - `createPrompt(data)`,
  - `updatePrompt(promptId, data)`,
  - `archivePrompt(promptId)`.

### 4.3 IPC & Preload

- Main process (`main/index.ts`):
  - New handlers:
    - `profilePrompts:list`
    - `profilePrompts:create`
    - `profilePrompts:update`
    - `profilePrompts:archive`
  - `generation:runFull` now accepts `promptId?: string` along with `profileIds`.
- `main/preload.ts` and `renderer/types/electron.d.ts`:
  - Expose `profilePromptsList`, `profilePromptsCreate`, `profilePromptsUpdate`, `profilePromptsArchive`.
  - Extend `generationRunFull` types to include optional `promptId`.

### 4.4 LLM Adapter & Pipeline

- `runResumePayload`:
  - Signature extended to accept `baseResumeText?: string` and `promptText?: string`.
  - Passes these to `buildCallBMessages`.
- `buildCallBMessages`:
  - Prepends prompt text and base resume sections before rules and INPUTS.
  - Keeps JD extraction, raw JD excerpt, and question list exactly as before.
- `runFullGeneration`:
  - **Multi-profile** path:
    - Unchanged semantics; now passes `profile.base_resume_text` into `runResumePayload` and leaves `promptText` `undefined`.
  - **Single-profile** path:
    - Reads `promptId` from params.
    - Uses `profilePromptsDao.getPrompt(promptId)` to resolve `promptText` when it belongs to the selected profile.
    - Calls `runResumePayload` with `baseResumeText` and resolved `promptText`.

---

## 5. Backward Compatibility & Migration

- Existing databases:
  - Migration 3 runs automatically and is idempotent.
  - All existing profiles get `base_resume_text = ''` until the user fills it in.
- Existing generations:
  - No schema change; historical generations continue to work and appear in History.
- Call B:
  - Legacy `resume_payload` handling remains as a fallback path inside `runResumePayload` and `templateMerge` for old outputs.

---

## 6. Testing Notes

- Single-profile, no prompt:
  - Paste JD, select profile, leave Prompt dropdown blank, generate.
  - Verify PDFs and JD.txt, and that behaviour matches previous versions (now grounded in base resume if provided).
- Single-profile, with prompt:
  - Create at least one prompt for the profile.
  - Select that profile and prompt, paste JD, generate.
  - Confirm the resulting resume/cover reflect the prompt’s emphasis.
- Multi-profile:
  - Select multiple profiles (with or without base resumes), run generation.
  - Confirm one job, one Call A, N generations (one per profile) still work, ignoring prompts for now.

