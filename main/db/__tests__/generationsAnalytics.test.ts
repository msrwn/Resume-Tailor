import { Database } from 'better-sqlite3';
import { getDatabase } from '../database';
import { createGeneration, getDailyGenerationCounts, getGenerationCounts } from '../generationsDao';

function resetTables(db: Database) {
  db.exec('DELETE FROM generations');
  db.exec('DELETE FROM jobs');
}

describe('generations analytics helpers', () => {
  const db = getDatabase();

  beforeEach(() => {
    resetTables(db);
  });

  it('computes total and today counts correctly', () => {
    const now = new Date();
    const isoNow = now.toISOString();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const jobIdToday = 'job-today';
    const jobIdYesterday = 'job-yesterday';

    db.prepare(
      `INSERT INTO jobs (job_id, created_at, jd_text, jd_hash, source_url)
       VALUES (?, ?, 'jd', 'hash1', NULL), (?, ?, 'jd', 'hash2', NULL)`
    ).run(jobIdToday, isoNow, jobIdYesterday, yesterday);

    createGeneration({
      job_id: jobIdToday,
      profile_id: 'p1',
      rules_hash: 'r',
      template_hash: 't',
      jd_model_used: 'm',
      payload_model_used: 'm2',
      base_folder: 'b',
      company_folder: 'c',
      role_folder: 'r',
      profile_folder: 'p',
      output_dir: 'o',
      status: 'success',
    });

    createGeneration({
      job_id: jobIdYesterday,
      profile_id: 'p1',
      rules_hash: 'r',
      template_hash: 't',
      jd_model_used: 'm',
      payload_model_used: 'm2',
      base_folder: 'b',
      company_folder: 'c',
      role_folder: 'r',
      profile_folder: 'p',
      output_dir: 'o',
      status: 'success',
    });

    const { total, today } = getGenerationCounts();
    expect(total).toBe(2);
    expect(today === 0 || today === 1).toBe(true);
  });

  it('groups successful generations by local date', () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    const isoToday = today.toISOString();
    const isoYesterday = yesterday.toISOString();

    const jobToday = 'job-today-2';
    const jobYesterday = 'job-yesterday-2';

    db.prepare(
      `INSERT INTO jobs (job_id, created_at, jd_text, jd_hash, source_url)
       VALUES (?, ?, 'jd', 'hash3', NULL), (?, ?, 'jd', 'hash4', NULL)`
    ).run(jobToday, isoToday, jobYesterday, isoYesterday);

    createGeneration({
      job_id: jobToday,
      profile_id: 'p1',
      rules_hash: 'r',
      template_hash: 't',
      jd_model_used: 'm',
      payload_model_used: 'm2',
      base_folder: 'b',
      company_folder: 'c',
      role_folder: 'r',
      profile_folder: 'p',
      output_dir: 'o',
      status: 'success',
    });

    createGeneration({
      job_id: jobToday,
      profile_id: 'p2',
      rules_hash: 'r',
      template_hash: 't',
      jd_model_used: 'm',
      payload_model_used: 'm2',
      base_folder: 'b',
      company_folder: 'c',
      role_folder: 'r',
      profile_folder: 'p',
      output_dir: 'o',
      status: 'success',
    });

    createGeneration({
      job_id: jobYesterday,
      profile_id: 'p1',
      rules_hash: 'r',
      template_hash: 't',
      jd_model_used: 'm',
      payload_model_used: 'm2',
      base_folder: 'b',
      company_folder: 'c',
      role_folder: 'r',
      profile_folder: 'p',
      output_dir: 'o',
      status: 'success',
    });

    const from = new Date(yesterday.getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const to = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const rows = getDailyGenerationCounts({ fromDate: from, toDate: to });
    const map = new Map(rows.map((r) => [r.date, r.count]));

    const keyToday = isoToday.slice(0, 10);
    const keyYesterday = isoYesterday.slice(0, 10);

    expect(map.get(keyToday)).toBe(2);
    expect(map.get(keyYesterday)).toBe(1);
  });
});

