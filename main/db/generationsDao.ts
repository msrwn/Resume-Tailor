import { getDatabase } from './database';
import { randomUUID } from 'crypto';
import type { Generation } from '../../shared/types';

export type DailyGenerationCount = {
  date: string;
  count: number;
};

/** Per-profile count for a single day (for stacked bar chart). */
export type DailyProfileSegment = {
  profile_id: string;
  count: number;
};

/** Daily totals with per-profile breakdown for stacked chart. */
export type DailyGenerationCountByProfile = {
  date: string;
  total: number;
  byProfile: DailyProfileSegment[];
};

export type CreateGenerationParams = {
  job_id: string;
  profile_id: string;
  prompt_id?: string | null;
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
      generation_id, job_id, profile_id, prompt_id, status, created_at,
      rules_hash, template_hash, jd_model_used, payload_model_used,
      fallback_used, fallback_reason,
      jd_input_tokens, jd_cached_input_tokens, jd_output_tokens,
      payload_input_tokens, payload_cached_input_tokens, payload_output_tokens,
      total_estimated_cost_usd,
      base_folder, company_folder, role_folder, profile_folder, output_dir,
      error_code, error_message, raw_model_output_snippet
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    generationId,
    data.job_id,
    data.profile_id,
    data.prompt_id ?? null,
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
 * Get all generations, newest first.
 * Used by history views to build a complete list of applications.
 */
export function getAllGenerations(): Generation[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM generations
    ORDER BY created_at DESC
  `);
  return stmt.all() as Generation[];
}

/**
 * Get a single page of generations for history listing.
 * Results are ordered newest-first and filtered by optional profile/date/keyword.
 * Uses limit+1 paging so callers can know if more rows exist.
 *
 * NOTE: Keyword filtering is pushed down into SQL so we don't page over the
 * full dataset and then filter in memory (which can otherwise drop matches
 * that fall outside the first page).
 */
export function getGenerationsPage(params: {
  profileId?: string;
  fromDate?: string;
  toDate?: string;
  keyword?: string;
  limit: number;
  offset: number;
}): { rows: Generation[]; hasMore: boolean } {
  const db = getDatabase();

  // We request one extra row so we can compute hasMore without a separate COUNT(*).
  const pageLimit = params.limit + 1;

  let sql = `
    SELECT * FROM generations
    WHERE 1=1
  `;
  const args: unknown[] = [];

  if (params.profileId) {
    sql += ` AND profile_id = ?`;
    args.push(params.profileId);
  }

  if (params.fromDate) {
    sql += ` AND created_at >= ?`;
    args.push(params.fromDate);
  }

  if (params.toDate) {
    sql += ` AND created_at <= ?`;
    args.push(params.toDate);
  }

  const trimmedKeyword =
    typeof params.keyword === 'string' ? params.keyword.trim().toLowerCase() : '';

  if (trimmedKeyword) {
    const like = `%${trimmedKeyword}%`;
    // Filter on common text fields directly in generations, and also via a
    // subquery on the related jobs row so we can match company / role / JD.
    sql += `
      AND (
        lower(company_folder) LIKE ?
        OR lower(role_folder) LIKE ?
        OR lower(profile_folder) LIKE ?
        OR lower(COALESCE(notes, '')) LIKE ?
        OR EXISTS (
          SELECT 1
          FROM jobs j
          WHERE j.job_id = generations.job_id
            AND (
              lower(COALESCE(j.company_name, '')) LIKE ?
              OR lower(COALESCE(j.job_title, '')) LIKE ?
              OR lower(COALESCE(j.jd_text, '')) LIKE ?
              OR lower(COALESCE(j.job_description_clean, '')) LIKE ?
              OR lower(COALESCE(j.contact_email, '')) LIKE ?
              OR lower(COALESCE(j.contact_phone, '')) LIKE ?
              OR lower(COALESCE(j.source_url, '')) LIKE ?
            )
        )
      )
    `;
    args.push(
      like, // company_folder
      like, // role_folder
      like, // profile_folder
      like, // notes
      like, // jobs.company_name
      like, // jobs.job_title
      like, // jobs.jd_text
      like, // jobs.job_description_clean
      like, // jobs.contact_email
      like, // jobs.contact_phone
      like // jobs.source_url
    );
  }

  sql += `
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;
  args.push(pageLimit, params.offset);

  const stmt = db.prepare(sql);
  const results = stmt.all(...args) as Generation[];

  const hasMore = results.length > params.limit;
  const rows = hasMore ? results.slice(0, params.limit) : results;

  return { rows, hasMore };
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
 * Update user notes (additional information) for a generation.
 */
export function updateGenerationNotes(generationId: string, notes: string | null): Generation | null {
  const db = getDatabase();
  const stmt = db.prepare(`UPDATE generations SET notes = ? WHERE generation_id = ?`);
  stmt.run(notes ?? null, generationId);
  return getGeneration(generationId);
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
 * Get counts of successful generations grouped by local date.
 * Optional fromDate/toDate are inclusive and use 'YYYY-MM-DD' local dates.
 */
export function getDailyGenerationCounts(params?: {
  fromDate?: string;
  toDate?: string;
}): DailyGenerationCount[] {
  const db = getDatabase();

  let sql = `
    SELECT
      date(created_at, 'localtime') as date,
      COUNT(*) as count
    FROM generations
    WHERE status = 'success'
  `;
  const args: unknown[] = [];

  if (params?.fromDate && params?.toDate) {
    sql += `
      AND date(created_at, 'localtime') BETWEEN ? AND ?
    `;
    args.push(params.fromDate, params.toDate);
  } else if (params?.fromDate) {
    sql += `
      AND date(created_at, 'localtime') >= ?
    `;
    args.push(params.fromDate);
  } else if (params?.toDate) {
    sql += `
      AND date(created_at, 'localtime') <= ?
    `;
    args.push(params.toDate);
  }

  sql += `
    GROUP BY date(created_at, 'localtime')
    ORDER BY date(created_at, 'localtime') ASC
  `;

  const stmt = db.prepare(sql);
  const rows = stmt.all(...args) as DailyGenerationCount[];
  return rows;
}

/**
 * Get counts of successful generations grouped by date and profile (for stacked bar chart).
 * Returns one row per date with total and per-profile segments.
 */
export function getDailyGenerationCountsByProfile(params?: {
  fromDate?: string;
  toDate?: string;
}): DailyGenerationCountByProfile[] {
  const db = getDatabase();

  let sql = `
    SELECT
      date(created_at, 'localtime') as date,
      profile_id,
      COUNT(*) as count
    FROM generations
    WHERE status = 'success'
  `;
  const args: unknown[] = [];

  if (params?.fromDate && params?.toDate) {
    sql += ` AND date(created_at, 'localtime') BETWEEN ? AND ?`;
    args.push(params.fromDate, params.toDate);
  } else if (params?.fromDate) {
    sql += ` AND date(created_at, 'localtime') >= ?`;
    args.push(params.fromDate);
  } else if (params?.toDate) {
    sql += ` AND date(created_at, 'localtime') <= ?`;
    args.push(params.toDate);
  }

  sql += `
    GROUP BY date(created_at, 'localtime'), profile_id
    ORDER BY date(created_at, 'localtime') ASC, profile_id ASC
  `;

  const stmt = db.prepare(sql);
  const rows = stmt.all(...args) as Array<{ date: string; profile_id: string; count: number }>;

  const byDate = new Map<string, DailyGenerationCountByProfile>();
  for (const row of rows) {
    let day = byDate.get(row.date);
    if (!day) {
      day = { date: row.date, total: 0, byProfile: [] };
      byDate.set(row.date, day);
    }
    day.total += row.count;
    day.byProfile.push({ profile_id: row.profile_id, count: row.count });
  }
  return Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
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
