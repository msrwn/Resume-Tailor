import { getDatabase } from './database';
import { randomUUID } from 'crypto';
import { sha256 } from '../../shared/utils';
import type { Job } from '../../shared/types';

/**
 * Create a job from JD text.
 */
export function createJob(data: {
  jd_text: string;
  source_url?: string;
}): Job {
  const db = getDatabase();
  const jobId = randomUUID();
  const now = new Date().toISOString();
  const jdHash = sha256(data.jd_text);

  const stmt = db.prepare(`
    INSERT INTO jobs (
      job_id, created_at, jd_text, jd_hash, source_url,
      company_name, job_title, job_type, budget, required_tech_stack,
      job_description_clean, contact_email, contact_phone,
      follow_up_links_json, contact_source_text
    ) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  `);

  stmt.run(jobId, now, data.jd_text, jdHash, data.source_url || null);

  return getJob(jobId)!;
}

/**
 * Get job by ID.
 */
export function getJob(jobId: string): Job | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM jobs WHERE job_id = ?');
  const result = stmt.get(jobId) as Job | undefined;
  return result || null;
}

/**
 * Update job with extracted data.
 */
export function updateJobExtraction(jobId: string, data: {
  company_name?: string | null;
  job_title?: string | null;
  job_type?: string | null;
  budget?: string | null;
  required_tech_stack?: string | null;
  job_description_clean?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  follow_up_links_json?: string | null;
  contact_source_text?: string | null;
}): Job {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE jobs
    SET company_name = COALESCE(?, company_name),
        job_title = COALESCE(?, job_title),
        job_type = COALESCE(?, job_type),
        budget = COALESCE(?, budget),
        required_tech_stack = COALESCE(?, required_tech_stack),
        job_description_clean = COALESCE(?, job_description_clean),
        contact_email = COALESCE(?, contact_email),
        contact_phone = COALESCE(?, contact_phone),
        follow_up_links_json = COALESCE(?, follow_up_links_json),
        contact_source_text = COALESCE(?, contact_source_text)
    WHERE job_id = ?
  `);

  stmt.run(
    data.company_name ?? null,
    data.job_title ?? null,
    data.job_type ?? null,
    data.budget ?? null,
    data.required_tech_stack ?? null,
    data.job_description_clean ?? null,
    data.contact_email ?? null,
    data.contact_phone ?? null,
    data.follow_up_links_json ?? null,
    data.contact_source_text ?? null,
    jobId
  );

  return getJob(jobId)!;
}

/**
 * Search jobs (simple LIKE search for MVP).
 */
export function searchJobs(query: {
  company_name?: string;
  job_title?: string;
  keyword?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}): Job[] {
  const db = getDatabase();
  const limit = query.limit || 50;
  const offset = query.offset || 0;

  let sql = 'SELECT * FROM jobs WHERE 1=1';
  const params: any[] = [];

  if (query.company_name) {
    sql += ' AND company_name LIKE ?';
    params.push(`%${query.company_name}%`);
  }

  if (query.job_title) {
    sql += ' AND job_title LIKE ?';
    params.push(`%${query.job_title}%`);
  }

  if (query.keyword) {
    sql += ' AND (jd_text LIKE ? OR company_name LIKE ? OR job_title LIKE ?)';
    const keyword = `%${query.keyword}%`;
    params.push(keyword, keyword, keyword);
  }

  if (query.fromDate) {
    sql += ' AND created_at >= ?';
    params.push(query.fromDate);
  }

  if (query.toDate) {
    sql += ' AND created_at <= ?';
    params.push(query.toDate);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = db.prepare(sql);
  return stmt.all(...params) as Job[];
}
