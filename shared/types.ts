// Shared types across main and renderer processes

export type AppConfig = {
  outputRootPath?: string;
  useDateBaseFolder: boolean;
  dateFolderFormat: string;
  /** Custom OpenAI API base URL (e.g. proxy or compatible endpoint). Leave empty for default. */
  openaiBaseURL?: string;
  jdExtractionModel?: string;
  resumePayloadModel?: string;
  fallbackModel?: string;
  retryCountCallA: number;
  retryCountCallB: number;
  fallbackEnabled: boolean;
};

export type Profile = {
  profile_id: string;
  name: string;
  rules_text: string;
  base_resume_text: string;
  template_html: string;
  rules_hash: string;
  template_hash: string;
  is_default: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type ProfilePrompt = {
  prompt_id: string;
  profile_id: string;
  name: string;
  prompt_text: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type Job = {
  job_id: string;
  created_at: string;
  jd_text: string;
  jd_hash: string;
  source_url: string | null;
  company_name: string | null;
  job_title: string | null;
  job_type: string | null;
  budget: string | null;
  required_tech_stack: string | null;
  job_description_clean: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  follow_up_links_json: string | null;
  contact_source_text: string | null;
};

export type Generation = {
  generation_id: string;
  job_id: string;
  profile_id: string;
  prompt_id: string | null;
  status: 'success' | 'failed';
  created_at: string;
  rules_hash: string;
  template_hash: string;
  jd_model_used: string;
  payload_model_used: string;
  fallback_used: number;
  fallback_reason: string | null;
  jd_input_tokens: number | null;
  jd_cached_input_tokens: number | null;
  jd_output_tokens: number | null;
  payload_input_tokens: number | null;
  payload_cached_input_tokens: number | null;
  payload_output_tokens: number | null;
  total_estimated_cost_usd: number | null;
  base_folder: string;
  company_folder: string;
  role_folder: string;
  profile_folder: string;
  output_dir: string;
  resume_pdf_path: string | null;
  cover_pdf_path: string | null;
  jd_txt_path: string | null;
  qa_pdf_path: string | null;
  error_code: string | null;
  error_message: string | null;
  raw_model_output_snippet: string | null;
  /** User-added notes / additional information for this history card. */
  notes: string | null;
};

export type GenerationProgress = {
  generation_id: string;
  step: GenerationStep;
  message: string;
  percent: number;
};

export type GenerationStep =
  | 'saving_job'
  | 'extracting_jd'
  | 'generating_payload'
  | 'validating'
  | 'rendering_pdfs'
  | 'writing_files'
  | 'done'
  | 'error';

/** Call A (JD Extraction) output from LLM */
export type CallAOutput = {
  company_name: string | null;
  job_title: string | null;
  job_type: string | null;
  budget: string | null;
  required_tech_stack: string | string[] | null;
  job_description_clean: string | null;
  contact: {
    email: string | null;
    phone: string | null;
    follow_up_links: string[] | null;
    source_text_snippets: string[] | null;
  };
};

/** Call B (Resume Payload + Cover) output from LLM. Supports rules schema (meta/resume/cover_letter) or legacy flat shape. */
export type CallBOutput = {
  owner_first_name: string;
  company_name: string | null;
  job_title: string | null;
  /** Legacy: flat payload for {{placeholder}} merge. Omitted when using rules schema (meta + resume). */
  resume_payload?: Record<string, unknown>;
  /** Legacy: cover text when not using rules schema. */
  cover_letter_text: string;
  /** Rules schema: meta block (when LLM returns rules-style JSON). */
  meta?: CallBMeta;
  /** Rules schema: structured resume (when LLM returns rules-style JSON). */
  resume?: CallBResume;
  /** Rules schema: cover_letter.text (when LLM returns rules-style JSON). */
  cover_letter?: { text: string };
  /** QA array: questions and answers (when questions are provided). */
  qa?: Array<{ question: string; answer: string }>;
  validation_targets?: Record<string, unknown>;
};

export type CallBMeta = {
  owner_first_name: string;
  owner_full_name?: string;
  company_name: string;
  job_title: string;
  role_display?: string;
  normalized_company_slug?: string;
  normalized_role_slug?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_github?: string;
  contact_address?: string;
  /** Optional LinkedIn profile URL or handle. */
  contact_linkedin?: string;
  /** Optional personal website or portfolio URL. */
  contact_website?: string;
};

export type CallBEducationEntry = {
  institution: string;
  degree: string;
  location?: string;
  /** Free-form dates string, e.g. "2014–2018" or "Expected 2026". */
  dates?: string;
  /** Optional notes, e.g. honors or specialization. */
  notes?: string;
};

export type CallBFreelanceProject = {
  role_title: string;
  client_name: string;
  project_name: string;
  project_description?: string;
  location?: string;
  duration?: string;
  tech_stack?: string[];
  bullets: Array<{ text: string; emphasized_terms?: string[] }>;
};

export type CallBResume = {
  headline: string;
  summary: { text: string; emphasized_terms?: string[] };
  skills: Array<{ category: string; items: string[] }>;
  experience: Array<{
    company_key: string;
    /** Full display name (e.g. "Matto Espresso"); use when company_key is a slug. */
    company_display_name?: string;
    role_title: string;
    location?: string;
    duration?: string;
    bullets: Array<{ text: string; emphasized_terms?: string[] }>;
  }>;
  /** Dedicated freelance/client projects (output format); when present, used for freelancing section. */
  freelance_projects?: CallBFreelanceProject[];
  certificates?: Array<{ title: string; url?: string }>;
  /** Education entries; supports multiple degrees. */
  education?: CallBEducationEntry[];
  /** Languages section, derived from base resume when present. */
  languages?: Array<{ name: string; proficiency?: string }>;
};

/** One profile's result from multi-profile generation. */
export type GenerationProfileResult = {
  profileId: string;
  profileName: string;
  generationId?: string;
  outputDir?: string;
  resumePdfPath?: string | null;
  coverPdfPath?: string | null;
  qaPdfPath?: string | null;
  error?: string;
};
