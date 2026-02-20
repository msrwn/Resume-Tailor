import { getDatabase } from './database';
import { randomUUID } from 'crypto';
import type { Generation } from '../../shared/types';

export type CreateGenerationParams = {
  job_id: string;
  profile_id: string;
  rules_hash: string;
  template_hash: string;
  jd_model_used: string;
  payload_model_used: string;
  base_folder: string;
  company_folder: string;
  role_folder: string;
  profile_folder: string;
  output_dir: string;
  status?: 'success' | 'failed';
  fallback_used?: number;
  fallback_reason?: string | null;
  jd_input_tokens?: number | null;
  jd_cached_input_tokens?: number | null;
  jd_output_tokens?: number | null;
  payload_input_tokens?: number | null;
  payload_cached_input_tokens?: number | null;
  payload_output_tokens?: number | null;
  total_estimated_cost_usd?: number | null;
  error_code?: string | null;
  error_message?: string | null;
  raw_model_output_snippet?: string | null;
  qa_pdf_path?: string | null;
};

/**
 * Create a generation record (success or failed).
 */
export function createGeneration(data: CreateGenerationParams): Generation {
  const db = getDatabase();
  const generationId = randomUUID();
  const now = new Date().toISOString();
  const status = data.status ?? 'success';

  const stmt = db.prepare(`
    INSERT INTO generations (
      generation_id, job_id, profile_id, status, created_at,
      rules_hash, template_hash, jd_model_used, payload_model_used,
      fallback_used, fallback_reason,
      jd_input_tokens, jd_cached_input_tokens, jd_output_tokens,
      payload_input_tokens, payload_cached_input_tokens, payload_output_tokens,
      total_estimated_cost_usd,
      base_folder, company_folder, role_folder, profile_folder, output_dir,
      error_code, error_message, raw_model_output_snippet
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    generationId,
    data.job_id,
    data.profile_id,
    status,
    now,
    data.rules_hash,
    data.template_hash,
    data.jd_model_used,
    data.payload_model_used,
    data.fallback_used ?? 0,
    data.fallback_reason ?? null,
    data.jd_input_tokens ?? null,
    data.jd_cached_input_tokens ?? null,
    data.jd_output_tokens ?? null,
    data.payload_input_tokens ?? null,
    data.payload_cached_input_tokens ?? null,
    data.payload_output_tokens ?? null,
    data.total_estimated_cost_usd ?? null,
    data.base_folder,
    data.company_folder,
    data.role_folder,
    data.profile_folder,
    data.output_dir,
    data.error_code ?? null,
    data.error_message ?? null,
    data.raw_model_output_snippet ?? null
  );

  return getGeneration(generationId)!;
}

/**
 * Get generation by ID.
 */
export function getGeneration(generationId: string): Generation | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM generations WHERE generation_id = ?');
  const result = stmt.get(generationId) as Generation | undefined;
  return result || null;
}

/**
 * Get latest generation for a job.
 */
export function getLatestGenerationForJob(jobId: string): Generation | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM generations
    WHERE job_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const result = stmt.get(jobId) as Generation | undefined;
  return result || null;
}

/**
 * Get latest successful generation matching normalized_url and profile_id (for autofill /match).
 */
export function getMatchGeneration(
  normalizedUrl: string,
  profileId: string
): (Generation & { output_dir: string }) | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT g.*
    FROM generations g
    JOIN jobs j ON g.job_id = j.job_id
    WHERE j.normalized_url = ?
      AND g.profile_id = ?
      AND g.status = 'success'
    ORDER BY g.created_at DESC
    LIMIT 1
  `);
  const row = stmt.get(normalizedUrl, profileId) as (Generation & { output_dir: string }) | undefined;
  return row || null;
}

/**
 * Get all generations for a job (for multi-profile: one card per generation).
 */
export function getGenerationsForJob(jobId: string): Generation[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM generations
    WHERE job_id = ?
    ORDER BY created_at DESC
  `);
  return stmt.all(jobId) as Generation[];
}

/**
 * Update generation with file paths.
 */
export function updateGenerationPaths(
  generationId: string,
  paths: {
    resume_pdf_path?: string | null;
    cover_pdf_path?: string | null;
    jd_txt_path?: string | null;
    qa_pdf_path?: string | null;
  }
): Generation {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE generations
    SET resume_pdf_path = COALESCE(?, resume_pdf_path),
        cover_pdf_path = COALESCE(?, cover_pdf_path),
        jd_txt_path = COALESCE(?, jd_txt_path),
        qa_pdf_path = COALESCE(?, qa_pdf_path)
    WHERE generation_id = ?
  `);

  stmt.run(
    paths.resume_pdf_path ?? null,
    paths.cover_pdf_path ?? null,
    paths.jd_txt_path ?? null,
    paths.qa_pdf_path ?? null,
    generationId
  );

  return getGeneration(generationId)!;
}

/**
 * Get counts of successful generations (resumes generated).
 * Returns total count and count for today (local date).
 */
export function getGenerationCounts(): { total: number; today: number } {
  const db = getDatabase();
  const totalStmt = db.prepare(
    `SELECT COUNT(*) as count FROM generations WHERE status = 'success'`
  );
  const total = (totalStmt.get() as { count: number }).count;
  const todayStmt = db.prepare(`
    SELECT COUNT(*) as count FROM generations
    WHERE status = 'success'
    AND date(created_at, 'localtime') = date('now', 'localtime')
  `);
  const today = (todayStmt.get() as { count: number }).count;
  return { total, today };
}

/**
 * Mark generation as failed.
 */
export function markGenerationFailed(
  generationId: string,
  error: {
    error_code: string;
    error_message: string;
    raw_model_output_snippet?: string | null;
  }
): Generation {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE generations
    SET status = 'failed',
        error_code = ?,
        error_message = ?,
        raw_model_output_snippet = ?
    WHERE generation_id = ?
  `);

  stmt.run(
    error.error_code,
    error.error_message,
    error.raw_model_output_snippet ?? null,
    generationId
  );

  return getGeneration(generationId)!;
}
