import { readConfig } from '../config/configManager';
import * as jobsDao from '../db/jobsDao';
import * as profilesDao from '../db/profilesDao';
import * as generationsDao from '../db/generationsDao';
import { runJdExtraction, runResumePayload } from '../llm/openaiAdapter';
import {
  buildOutputDirectory,
  computeBaseFolder,
  generateOutputFilePaths,
  extractOwnerFirstName,
  ensureDir,
} from '../fs/filesystem';
import { validateCallBOutput } from '../validation/validator';
import { mergeResumeTemplate, getTemplatePlaceholderKeys, buildMergePayloadFromStructuredResume } from '../pdf/templateMerge';

/** Normalize legacy resume_payload so it has the same keys as structured payload for merge. */
function normalizeLegacyPayload(
  resumePayload: Record<string, unknown>,
  ownerFirstName: string
): Record<string, unknown> {
  const str = (v: unknown) => (v != null && typeof v === 'string' ? v : '');
  return {
    owner_first_name: ownerFirstName,
    headline: str(resumePayload.headline),
    summary: str(resumePayload.summary),
    skills: str(resumePayload.skills),
    experience: str(resumePayload.experience),
    education: str(resumePayload.education),
    certificates: str(resumePayload.certificates),
  };
}
import { buildCoverLetterHtml } from '../pdf/coverLetterHtml';
import { buildQAHtml } from '../pdf/qaHtml';
import { renderHtmlToPdf } from '../pdf/pdfRenderer';
import * as fs from 'fs';
import path from 'path';
import { normalizeJobUrl } from '../../shared/jobUrl';
import type { CallAOutput, CallBOutput, GenerationProfileResult } from '../../shared/types';
import type { GenerationStep } from '../../shared/types';
import type { Job } from '../../shared/types';
import type { Generation } from '../../shared/types';
import type { Profile } from '../../shared/types';

export type ProgressCallback = (step: GenerationStep, message: string, percent: number) => void;

function toOptionalString(v: string | string[] | null): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.length ? JSON.stringify(v) : null;
  return String(v);
}

/**
 * Map Call A output to job extraction update payload.
 */
function mapCallAToJobUpdate(_jobId: string, out: CallAOutput): Parameters<typeof jobsDao.updateJobExtraction>[1] {
  const contact = out.contact || {};
  const followUpLinks = contact.follow_up_links;
  const snippets = contact.source_text_snippets;

  return {
    company_name: out.company_name ?? null,
    job_title: out.job_title ?? null,
    job_type: out.job_type ?? null,
    budget: out.budget ?? null,
    required_tech_stack: toOptionalString(out.required_tech_stack),
    job_description_clean: out.job_description_clean ?? null,
    contact_email: contact.email ?? null,
    contact_phone: contact.phone ?? null,
    follow_up_links_json: Array.isArray(followUpLinks) ? JSON.stringify(followUpLinks.slice(0, 5)) : null,
    contact_source_text: Array.isArray(snippets) ? snippets.join('\n') : null,
  };
}

/**
 * Write job.json to output folder (job meta + Q&A from Call B). Apply Automation feature.
 */
function writeJobJson(
  outputDir: string,
  job: Job,
  qa: Array<{ question: string; answer: string }> | undefined
): void {
  const now = new Date().toISOString();
  const payload = {
    schemaVersion: '1.0',
    createdAt: now,
    jobId: job.job_id,
    jobMeta: {
      companyName: job.company_name ?? null,
      jobTitle: job.job_title ?? null,
      jobType: job.job_type ?? null,
      sourceUrl: job.source_url ?? null,
    },
    qa: Array.isArray(qa) && qa.length > 0 ? qa : [],
  };
  const filePath = path.join(outputDir, 'job.json');
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
}

/**
 * Write autofill_data.json only when job has source_url and normalized_url. No PII. Apply Automation feature.
 */
function writeAutofillDataJson(
  outputDir: string,
  job: Job,
  gen: Generation,
  profile: Profile,
  paths: { resumePdfPath: string; coverPdfPath: string; jdTxtPath: string; qaPdfPath: string | null }
): void {
  if (!job.source_url || !job.normalized_url) return;
  try {
    const hostname = new URL(job.normalized_url).hostname;
    const now = new Date().toISOString();
    const payload = {
      schemaVersion: '1.0',
      createdAt: now,
      generation: {
        generationId: gen.generation_id,
        jobId: job.job_id,
        profileId: profile.profile_id,
        profileName: profile.name,
      },
      match: {
        sourceUrl: job.source_url,
        normalizedUrl: job.normalized_url,
        platformId: job.platform_id ?? 'other',
        hostname,
      },
      files: {
        outputDir: path.resolve(outputDir),
        resumePdfPath: path.resolve(paths.resumePdfPath),
        coverPdfPath: path.resolve(paths.coverPdfPath),
        qaPdfPath: paths.qaPdfPath ? path.resolve(paths.qaPdfPath) : null,
      },
      jobMeta: {
        companyName: job.company_name ?? null,
        jobTitle: job.job_title ?? null,
      },
    };
    const filePath = path.join(outputDir, 'autofill_data.json');
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') console.warn('[Pipeline] Could not write autofill_data.json:', e);
  }
}

/** Config type for pipeline (subset we need in helpers). */
type PipelineConfig = ReturnType<typeof readConfig>;

/**
 * Run one profile's generation after job and Call A already exist (for multi-profile).
 * Returns result with paths or error; creates generation row (success or failed).
 */
async function runOneProfileGeneration(params: {
  job: ReturnType<typeof jobsDao.getJob>;
  callAResult: { json: CallAOutput; modelUsed: string; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  profileId: string;
  questions: string[] | undefined;
  config: PipelineConfig;
  emit: (step: GenerationStep, message: string, percent: number) => void;
  index: number;
  total: number;
}): Promise<GenerationProfileResult> {
  const { job, callAResult, profileId, questions, config, emit, index, total } = params;
  if (!job) {
    return { profileId, profileName: '?', error: 'Job not found' };
  }
  const profile = profilesDao.getProfile(profileId);
  if (!profile) {
    return { profileId, profileName: '?', error: 'Profile not found' };
  }
  const jobId = job.job_id;
  const baseFolder = computeBaseFolder();
  const dirResult = buildOutputDirectory({
    outputRootPath: config.outputRootPath!,
    baseFolder,
    companyName: job.company_name ?? null,
    jobTitle: job.job_title ?? null,
    profileName: profile.name,
    jdHash: job.jd_hash,
  });

  emit('generating_payload', `Generating for ${profile.name} (${index + 1}/${total})...`, 30 + (50 * index) / total);
  const callBResult = await runResumePayload({
    jdText: job.jd_text,
    rulesText: profile.rules_text,
    callA: callAResult.json,
    templateHtml: profile.template_html,
    questions,
    model: config.resumePayloadModel,
    fallbackModel: config.fallbackModel,
    retryCount: config.retryCountCallB,
    fallbackEnabled: config.fallbackEnabled,
  });

  if (!callBResult.success) {
    const gen = generationsDao.createGeneration({
      job_id: jobId,
      profile_id: profileId,
      rules_hash: profile.rules_hash,
      template_hash: profile.template_hash,
      jd_model_used: callAResult.modelUsed,
      payload_model_used: callBResult.modelUsed,
      base_folder: dirResult.base_folder,
      company_folder: dirResult.company_folder,
      role_folder: dirResult.role_folder,
      profile_folder: dirResult.profile_folder,
      output_dir: dirResult.outputDir,
      status: 'failed',
      fallback_used: callBResult.fallbackUsed ? 1 : 0,
      fallback_reason: callBResult.fallbackReason ?? null,
      error_code: 'CALL_B_FAILED',
      error_message: callBResult.error,
      raw_model_output_snippet: callBResult.rawText ?? null,
    });
    return {
      profileId,
      profileName: profile.name,
      generationId: gen.generation_id,
      error: callBResult.error ?? 'Call B failed',
    };
  }

  try {
    ensureDir(dirResult.outputDir);
    fs.writeFileSync(
      path.join(dirResult.outputDir, 'call-b-response.json'),
      JSON.stringify(callBResult.json, null, 2),
      'utf-8'
    );
    if (callBResult.rawText) {
      fs.writeFileSync(path.join(dirResult.outputDir, 'call-b-raw.txt'), callBResult.rawText, 'utf-8');
    }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') console.warn('[Pipeline] Could not save Call B debug files:', e);
  }

  emit('validating', `Validating ${profile.name}...`, 75);
  const validation = validateCallBOutput(callBResult.json, profile.rules_text, Boolean(questions?.length));
  if (!validation.valid) {
    const gen = generationsDao.createGeneration({
      job_id: jobId,
      profile_id: profileId,
      rules_hash: profile.rules_hash,
      template_hash: profile.template_hash,
      jd_model_used: callAResult.modelUsed,
      payload_model_used: callBResult.modelUsed,
      base_folder: dirResult.base_folder,
      company_folder: dirResult.company_folder,
      role_folder: dirResult.role_folder,
      profile_folder: dirResult.profile_folder,
      output_dir: dirResult.outputDir,
      status: 'failed',
      fallback_used: callBResult.fallbackUsed ? 1 : 0,
      fallback_reason: callBResult.fallbackReason ?? null,
      error_code: 'VALIDATION_FAILED',
      error_message: validation.errors.join('; '),
      raw_model_output_snippet: callBResult.rawText ? callBResult.rawText.slice(0, 1000) : null,
    });
    return {
      profileId,
      profileName: profile.name,
      generationId: gen.generation_id,
      error: validation.errors.join('; '),
    };
  }

  const jdUsage = callAResult.usage;
  const payloadUsage = callBResult.usage;
  const gen = generationsDao.createGeneration({
    job_id: jobId,
    profile_id: profileId,
    rules_hash: profile.rules_hash,
    template_hash: profile.template_hash,
    jd_model_used: callAResult.modelUsed,
    payload_model_used: callBResult.modelUsed,
    base_folder: dirResult.base_folder,
    company_folder: dirResult.company_folder,
    role_folder: dirResult.role_folder,
    profile_folder: dirResult.profile_folder,
    output_dir: dirResult.outputDir,
    status: 'success',
    fallback_used: callBResult.fallbackUsed ? 1 : 0,
    fallback_reason: callBResult.fallbackReason ?? null,
    jd_input_tokens: jdUsage?.prompt_tokens ?? null,
    jd_cached_input_tokens: null,
    jd_output_tokens: jdUsage?.completion_tokens ?? null,
    payload_input_tokens: payloadUsage?.prompt_tokens ?? null,
    payload_cached_input_tokens: null,
    payload_output_tokens: payloadUsage?.completion_tokens ?? null,
    total_estimated_cost_usd: null,
  });

  const ownerFirstName =
    callBResult.json.owner_first_name?.trim() || extractOwnerFirstName(profile.rules_text);
  const filePaths = generateOutputFilePaths({ outputDir: dirResult.outputDir, ownerFirstName });

  let resumePdfPath: string | null = null;
  let coverPdfPath: string | null = null;
  let jdTxtPath: string | null = null;
  let qaPdfPath: string | null = null;

  try {
    const payload: Record<string, unknown> =
      callBResult.json.resume != null
        ? buildMergePayloadFromStructuredResume(callBResult.json.resume, ownerFirstName)
        : normalizeLegacyPayload(callBResult.json.resume_payload ?? {}, ownerFirstName);
    const resumeHtml = mergeResumeTemplate(profile.template_html, payload, ownerFirstName);
    const resumePdfBuffer = await renderHtmlToPdf(resumeHtml);
    fs.writeFileSync(filePaths.resumePdfPath, resumePdfBuffer);
    resumePdfPath = filePaths.resumePdfPath;

    const coverText = callBResult.json.cover_letter?.text ?? callBResult.json.cover_letter_text ?? '';
    const coverHtml = buildCoverLetterHtml(coverText);
    const coverPdfBuffer = await renderHtmlToPdf(coverHtml);
    fs.writeFileSync(filePaths.coverPdfPath, coverPdfBuffer);
    coverPdfPath = filePaths.coverPdfPath;

    fs.writeFileSync(filePaths.jdTxtPath, job.jd_text, 'utf-8');
    jdTxtPath = filePaths.jdTxtPath;

    if (questions && questions.length > 0 && callBResult.json.qa && callBResult.json.qa.length > 0) {
      try {
        const qaHtml = buildQAHtml(callBResult.json.qa);
        if (qaHtml) {
          const qaPdfBuffer = await renderHtmlToPdf(qaHtml);
          fs.writeFileSync(filePaths.qaPdfPath, qaPdfBuffer);
          qaPdfPath = filePaths.qaPdfPath;
        }
      } catch (qaError) {
        console.error('[Pipeline] QA PDF generation failed:', qaError);
      }
    }

    generationsDao.updateGenerationPaths(gen.generation_id, {
      resume_pdf_path: resumePdfPath,
      cover_pdf_path: coverPdfPath,
      jd_txt_path: jdTxtPath,
      qa_pdf_path: qaPdfPath,
    });

    try {
      writeJobJson(dirResult.outputDir, job, callBResult.json.qa);
      writeAutofillDataJson(dirResult.outputDir, job, gen, profile, {
        resumePdfPath: resumePdfPath!,
        coverPdfPath: coverPdfPath!,
        jdTxtPath: jdTxtPath!,
        qaPdfPath,
      });
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') console.warn('[Pipeline] Could not write job.json/autofill_data.json:', e);
    }
  } catch (pdfError) {
    const errMsg = pdfError instanceof Error ? pdfError.message : String(pdfError);
    generationsDao.markGenerationFailed(gen.generation_id, {
      error_code: 'PDF_RENDER_ERROR',
      error_message: errMsg,
      raw_model_output_snippet: null,
    });
    return {
      profileId,
      profileName: profile.name,
      generationId: gen.generation_id,
      error: errMsg,
    };
  }

  return {
    profileId,
    profileName: profile.name,
    generationId: gen.generation_id,
    outputDir: dirResult.outputDir,
    resumePdfPath,
    coverPdfPath,
    qaPdfPath,
  };
}

/**
 * Run generation pipeline through Call A only (Milestone 6).
 * Creates job, runs JD extraction, persists to job. Does not create generation record or PDFs yet.
 */
export async function runGenerationCallAOnly(params: {
  jdText: string;
  sourceUrl?: string;
  profileId?: string;
  profileIds?: string[];
  onProgress?: ProgressCallback;
}): Promise<{
  success: boolean;
  jobId?: string;
  job?: ReturnType<typeof jobsDao.getJob>;
  error?: string;
  rawResponse?: string;
  extraction?: CallAOutput;
}> {
  const profileId = params.profileIds?.[0] ?? params.profileId;
  if (!profileId) {
    return { success: false, error: 'Profile is required' };
  }
  const { jdText, sourceUrl, onProgress } = params;
  const config = readConfig();

  const emit = (step: GenerationStep, message: string, percent: number) => {
    onProgress?.(step, message, percent);
  };

  if (!jdText.trim()) {
    return { success: false, error: 'JD text is required' };
  }

  const profile = profilesDao.getProfile(profileId);
  if (!profile) {
    return { success: false, error: 'Profile not found' };
  }

  if (!config.outputRootPath) {
    return { success: false, error: 'Output path is not set. Configure it in Settings.' };
  }

  emit('saving_job', 'Saving job...', 5);
  const job = jobsDao.createJob({ jd_text: jdText.trim(), source_url: sourceUrl || undefined });
  const jobId = job.job_id;

  emit('extracting_jd', 'Extracting job details (Call A)...', 20);

  const result = await runJdExtraction({
    jdText: job.jd_text,
    rulesText: profile.rules_text,
    jobUrl: sourceUrl,
    model: config.jdExtractionModel,
    fallbackModel: config.fallbackModel,
    retryCount: config.retryCountCallA,
    fallbackEnabled: config.fallbackEnabled,
  });

  if (!result.success) {
    emit('error', result.error, 100);
    return {
      success: false,
      jobId,
      error: result.error,
      rawResponse: result.rawText,
    };
  }

  emit('extracting_jd', 'Saving extracted data...', 80);
  jobsDao.updateJobExtraction(jobId, mapCallAToJobUpdate(jobId, result.json));

  emit('done', 'Extraction complete.', 100);
  const updatedJob = jobsDao.getJob(jobId);

  return {
    success: true,
    jobId,
    job: updatedJob ?? undefined,
    extraction: result.json,
  };
}

/** Single-profile success return (unchanged shape for backward compat). */
export type RunFullGenerationSingleResult = {
  success: true;
  jobId: string;
  generationId: string;
  job: NonNullable<ReturnType<typeof jobsDao.getJob>>;
  extraction: CallAOutput;
  callBOutput: CallBOutput;
  outputDir: string;
  resumePdfPath: string | null;
  coverPdfPath: string | null;
  jdTxtPath: string | null;
  qaPdfPath: string | null;
};

/** Multi-profile success return. */
export type RunFullGenerationMultiResult = {
  success: boolean;
  jobId: string;
  job: NonNullable<ReturnType<typeof jobsDao.getJob>>;
  extraction: CallAOutput;
  results: GenerationProfileResult[];
};

/**
 * Run full generation: Call A -> Call B -> validate -> persist generation -> render PDFs + JD.txt.
 * Accepts profileId (single) or profileIds (array). Single profile returns same shape as before; multi returns results[].
 */
export async function runFullGeneration(params: {
  jdText: string;
  sourceUrl?: string;
  profileId?: string;
  profileIds?: string[];
  questions?: string[];
  onProgress?: ProgressCallback;
}): Promise<
  | RunFullGenerationSingleResult
  | RunFullGenerationMultiResult
  | { success: false; jobId?: string; generationId?: string; error?: string; rawResponse?: string; validationErrors?: string[] }
> {
  const profileIds = params.profileIds ?? (params.profileId ? [params.profileId] : []);
  if (profileIds.length === 0) {
    return { success: false, error: 'At least one profile is required' };
  }

  const config = readConfig();
  const emit = (step: GenerationStep, message: string, percent: number) => {
    params.onProgress?.(step, message, percent);
  };

  if (!params.jdText.trim()) {
    return { success: false, error: 'JD text is required' };
  }

  const { normalizedUrl } = normalizeJobUrl(params.sourceUrl);
  if (normalizedUrl === null && (params.sourceUrl ?? '').trim() !== '') {
    return { success: false, error: 'Job URL is invalid. Please enter a valid http(s) URL.' };
  }
  if (!params.sourceUrl?.trim()) {
    return { success: false, error: 'Job URL is required for generation.' };
  }

  // Multi-profile: one job, one Call A, then one generation per profile
  if (profileIds.length > 1) {
    const firstProfile = profilesDao.getProfile(profileIds[0]);
    if (!firstProfile) {
      return { success: false, error: 'Profile not found' };
    }
    if (!config.outputRootPath) {
      return { success: false, error: 'Output path is not set. Configure it in Settings.' };
    }
    emit('saving_job', 'Saving job...', 5);
    const job = jobsDao.createJob({ jd_text: params.jdText.trim(), source_url: params.sourceUrl || undefined });
    const jobId = job.job_id;
    emit('extracting_jd', 'Extracting job details (Call A)...', 15);
    const callAResult = await runJdExtraction({
      jdText: job.jd_text,
      rulesText: firstProfile.rules_text,
      jobUrl: params.sourceUrl,
      model: config.jdExtractionModel,
      fallbackModel: config.fallbackModel,
      retryCount: config.retryCountCallA,
      fallbackEnabled: config.fallbackEnabled,
    });
    if (!callAResult.success) {
      emit('error', callAResult.error, 100);
      return {
        success: false,
        jobId,
        error: callAResult.error,
        rawResponse: callAResult.rawText,
      };
    }
    emit('extracting_jd', 'Saving extracted data...', 25);
    jobsDao.updateJobExtraction(jobId, mapCallAToJobUpdate(jobId, callAResult.json));
    const jobAfterExtraction = jobsDao.getJob(jobId)!;
    if (jobAfterExtraction.source_url) {
      const { normalizedUrl, platformId } = normalizeJobUrl(jobAfterExtraction.source_url);
      jobsDao.updateJobMatchFields(jobId, { normalized_url: normalizedUrl, platform_id: platformId });
    }
    const updatedJob = jobsDao.getJob(jobId)!;
    const results: GenerationProfileResult[] = [];
    for (let i = 0; i < profileIds.length; i++) {
      const r = await runOneProfileGeneration({
        job: updatedJob,
        callAResult: { json: callAResult.json, modelUsed: callAResult.modelUsed, usage: callAResult.usage },
        profileId: profileIds[i],
        questions: params.questions,
        config,
        emit,
        index: i,
        total: profileIds.length,
      });
      results.push(r);
    }
    const anySuccess = results.some((r) => !r.error);
    emit('done', anySuccess ? 'Generation complete.' : 'Completed with errors.', 100);
    return {
      success: anySuccess,
      jobId,
      job: updatedJob,
      extraction: callAResult.json,
      results,
    };
  }

  // Single profile: existing flow
  const profileId = profileIds[0];
  const profile = profilesDao.getProfile(profileId);
  if (!profile) {
    return { success: false, error: 'Profile not found' };
  }
  const jdText = params.jdText;
  const sourceUrl = params.sourceUrl;

  if (!config.outputRootPath) {
    return { success: false, error: 'Output path is not set. Configure it in Settings.' };
  }

  emit('saving_job', 'Saving job...', 5);
  const job = jobsDao.createJob({ jd_text: jdText.trim(), source_url: sourceUrl || undefined });
  const jobId = job.job_id;

  emit('extracting_jd', 'Extracting job details (Call A)...', 15);
  const callAResult = await runJdExtraction({
    jdText: job.jd_text,
    rulesText: profile.rules_text,
    jobUrl: sourceUrl,
    model: config.jdExtractionModel,
    fallbackModel: config.fallbackModel,
    retryCount: config.retryCountCallA,
    fallbackEnabled: config.fallbackEnabled,
  });

  if (!callAResult.success) {
    emit('error', callAResult.error, 100);
    return {
      success: false,
      jobId,
      error: callAResult.error,
      rawResponse: callAResult.rawText,
    };
  }

  emit('extracting_jd', 'Saving extracted data...', 25);
  jobsDao.updateJobExtraction(jobId, mapCallAToJobUpdate(jobId, callAResult.json));
  const jobAfterExtraction = jobsDao.getJob(jobId)!;
  if (jobAfterExtraction.source_url) {
    const { normalizedUrl, platformId } = normalizeJobUrl(jobAfterExtraction.source_url);
    jobsDao.updateJobMatchFields(jobId, { normalized_url: normalizedUrl, platform_id: platformId });
  }
  const updatedJob = jobsDao.getJob(jobId)!;

  const baseFolder = computeBaseFolder();
  const dirResult = buildOutputDirectory({
    outputRootPath: config.outputRootPath!,
    baseFolder,
    companyName: updatedJob.company_name,
    jobTitle: updatedJob.job_title,
    profileName: profile.name,
    jdHash: job.jd_hash,
  });

  emit('generating_payload', 'Generating resume and cover letter (Call B)...', 35);
  const callBResult = await runResumePayload({
    jdText: job.jd_text,
    rulesText: profile.rules_text,
    callA: callAResult.json,
    templateHtml: profile.template_html,
    questions: params.questions,
    model: config.resumePayloadModel,
    fallbackModel: config.fallbackModel,
    retryCount: config.retryCountCallB,
    fallbackEnabled: config.fallbackEnabled,
  });

  if (!callBResult.success) {
    const gen = generationsDao.createGeneration({
      job_id: jobId,
      profile_id: profileId,
      rules_hash: profile.rules_hash,
      template_hash: profile.template_hash,
      jd_model_used: callAResult.modelUsed,
      payload_model_used: callBResult.modelUsed,
      base_folder: dirResult.base_folder,
      company_folder: dirResult.company_folder,
      role_folder: dirResult.role_folder,
      profile_folder: dirResult.profile_folder,
      output_dir: dirResult.outputDir,
      status: 'failed',
      fallback_used: callBResult.fallbackUsed ? 1 : 0,
      fallback_reason: callBResult.fallbackReason ?? null,
      error_code: 'CALL_B_FAILED',
      error_message: callBResult.error,
      raw_model_output_snippet: callBResult.rawText ?? null,
    });
    emit('error', callBResult.error ?? 'Call B failed', 100);
    return {
      success: false,
      jobId,
      generationId: gen.generation_id,
      error: callBResult.error,
      rawResponse: callBResult.rawText,
    };
  }

  // Save Call B result for debugging (parsed JSON + raw response)
  try {
    ensureDir(dirResult.outputDir);
    fs.writeFileSync(
      path.join(dirResult.outputDir, 'call-b-response.json'),
      JSON.stringify(callBResult.json, null, 2),
      'utf-8'
    );
    if (callBResult.rawText) {
      fs.writeFileSync(
        path.join(dirResult.outputDir, 'call-b-raw.txt'),
        callBResult.rawText,
        'utf-8'
      );
    }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Pipeline] Could not save Call B debug files:', e);
    }
  }

  emit('validating', 'Validating output...', 75);
  const validation = validateCallBOutput(callBResult.json, profile.rules_text, params.questions && params.questions.length > 0);
  if (!validation.valid) {
    const gen = generationsDao.createGeneration({
      job_id: jobId,
      profile_id: profileId,
      rules_hash: profile.rules_hash,
      template_hash: profile.template_hash,
      jd_model_used: callAResult.modelUsed,
      payload_model_used: callBResult.modelUsed,
      base_folder: dirResult.base_folder,
      company_folder: dirResult.company_folder,
      role_folder: dirResult.role_folder,
      profile_folder: dirResult.profile_folder,
      output_dir: dirResult.outputDir,
      status: 'failed',
      fallback_used: callBResult.fallbackUsed ? 1 : 0,
      fallback_reason: callBResult.fallbackReason ?? null,
      error_code: 'VALIDATION_FAILED',
      error_message: validation.errors.join('; '),
      raw_model_output_snippet: callBResult.rawText ? callBResult.rawText.slice(0, 1000) : null,
    });
    emit('error', validation.errors[0] ?? 'Validation failed', 100);
    return {
      success: false,
      jobId,
      generationId: gen.generation_id,
      error: validation.errors.join('; '),
      validationErrors: validation.errors,
    };
  }

  emit('writing_files', 'Saving generation record...', 85);
  const jdUsage = callAResult.usage;
  const payloadUsage = callBResult.usage;

  const gen = generationsDao.createGeneration({
    job_id: jobId,
    profile_id: profileId,
    rules_hash: profile.rules_hash,
    template_hash: profile.template_hash,
    jd_model_used: callAResult.modelUsed,
    payload_model_used: callBResult.modelUsed,
    base_folder: dirResult.base_folder,
    company_folder: dirResult.company_folder,
    role_folder: dirResult.role_folder,
    profile_folder: dirResult.profile_folder,
    output_dir: dirResult.outputDir,
    status: 'success',
    fallback_used: callBResult.fallbackUsed ? 1 : 0,
    fallback_reason: callBResult.fallbackReason ?? null,
    jd_input_tokens: jdUsage?.prompt_tokens ?? null,
    jd_cached_input_tokens: null,
    jd_output_tokens: jdUsage?.completion_tokens ?? null,
    payload_input_tokens: payloadUsage?.prompt_tokens ?? null,
    payload_cached_input_tokens: null,
    payload_output_tokens: payloadUsage?.completion_tokens ?? null,
    total_estimated_cost_usd: null,
  });

  const ownerFirstName =
    callBResult.json.owner_first_name?.trim() ||
    extractOwnerFirstName(profile.rules_text);
  const filePaths = generateOutputFilePaths({
    outputDir: dirResult.outputDir,
    ownerFirstName,
  });

  let resumePdfPath: string | null = null;
  let coverPdfPath: string | null = null;
  let jdTxtPath: string | null = null;
  let qaPdfPath: string | null = null;

  try {
    emit('rendering_pdfs', 'Rendering resume PDF...', 88);
    // Always build one payload with keys: headline, summary, skills, experience, education, certificates. Insert that into the template.
    const payload: Record<string, unknown> =
      callBResult.json.resume != null
        ? buildMergePayloadFromStructuredResume(callBResult.json.resume, ownerFirstName)
        : normalizeLegacyPayload(callBResult.json.resume_payload ?? {}, ownerFirstName);

    if (process.env.NODE_ENV !== 'production') {
      const keys = Object.keys(payload);
      const preview: Record<string, string> = {};
      for (const k of keys) {
        const v = payload[k];
        const s = v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v);
        preview[k] = s.length > 100 ? s.slice(0, 100) + '...' : s;
      }
      const templateKeys = getTemplatePlaceholderKeys(profile.template_html);
      console.log('[Pipeline] Template placeholders:', templateKeys);
      console.log('[Pipeline] Payload keys:', keys);
      console.log('[Pipeline] Payload preview:', preview);
    }
    const resumeHtml = mergeResumeTemplate(
      profile.template_html,
      payload,
      ownerFirstName
    );
    if (process.env.NODE_ENV !== 'production') {
      const debugPath = path.join(dirResult.outputDir, 'resume-debug.html');
      fs.writeFileSync(debugPath, resumeHtml, 'utf-8');
      const hasUnreplaced = resumeHtml.includes('{{');
      console.log('[Pipeline] Merged resume HTML written to', debugPath);
      console.log('[Pipeline] Merged HTML still contains {{ placeholders?', hasUnreplaced);
    }
    const resumePdfBuffer = await renderHtmlToPdf(resumeHtml);
    fs.writeFileSync(filePaths.resumePdfPath, resumePdfBuffer);
    resumePdfPath = filePaths.resumePdfPath;

    emit('rendering_pdfs', 'Rendering cover letter PDF...', 92);
    const coverText =
      callBResult.json.cover_letter?.text ?? callBResult.json.cover_letter_text ?? '';
    const coverHtml = buildCoverLetterHtml(coverText);
    const coverPdfBuffer = await renderHtmlToPdf(coverHtml);
    fs.writeFileSync(filePaths.coverPdfPath, coverPdfBuffer);
    coverPdfPath = filePaths.coverPdfPath;

    emit('writing_files', 'Writing JD.txt...', 96);
    fs.writeFileSync(filePaths.jdTxtPath, job.jd_text, 'utf-8');
    jdTxtPath = filePaths.jdTxtPath;

    // Generate QA PDF if questions were provided and QA array exists
    if (params.questions && params.questions.length > 0 && callBResult.json.qa && callBResult.json.qa.length > 0) {
      try {
        emit('rendering_pdfs', 'Rendering QA PDF...', 94);
        const qaHtml = buildQAHtml(callBResult.json.qa);
        if (qaHtml) {
          const qaPdfBuffer = await renderHtmlToPdf(qaHtml);
          fs.writeFileSync(filePaths.qaPdfPath, qaPdfBuffer);
          qaPdfPath = filePaths.qaPdfPath;
        }
      } catch (qaError) {
        // Log error but don't fail the entire generation
        console.error('[Pipeline] QA PDF generation failed:', qaError);
        // Continue without QA PDF
      }
    }

    generationsDao.updateGenerationPaths(gen.generation_id, {
      resume_pdf_path: resumePdfPath,
      cover_pdf_path: coverPdfPath,
      jd_txt_path: jdTxtPath,
      qa_pdf_path: qaPdfPath,
    });

    try {
      writeJobJson(dirResult.outputDir, updatedJob, callBResult.json.qa);
      writeAutofillDataJson(dirResult.outputDir, updatedJob, gen, profile, {
        resumePdfPath: resumePdfPath!,
        coverPdfPath: coverPdfPath!,
        jdTxtPath: jdTxtPath!,
        qaPdfPath,
      });
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') console.warn('[Pipeline] Could not write job.json/autofill_data.json:', e);
    }
  } catch (pdfError) {
    const errMsg = pdfError instanceof Error ? pdfError.message : String(pdfError);
    generationsDao.markGenerationFailed(gen.generation_id, {
      error_code: 'PDF_RENDER_ERROR',
      error_message: errMsg,
      raw_model_output_snippet: null,
    });
    emit('error', errMsg, 100);
    return {
      success: false,
      jobId,
      generationId: gen.generation_id,
      error: errMsg,
    };
  }

  emit('done', 'Generation complete.', 100);

  return {
    success: true,
    jobId,
    generationId: gen.generation_id,
    job: updatedJob,
    extraction: callAResult.json,
    callBOutput: callBResult.json,
    outputDir: dirResult.outputDir,
    resumePdfPath,
    coverPdfPath,
    jdTxtPath,
    qaPdfPath,
  };
}
