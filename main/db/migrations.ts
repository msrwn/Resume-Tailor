import type Database from 'better-sqlite3';

const CURRENT_VERSION = 3;

/**
 * Run all migrations up to current version.
 */
export function runMigrations(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number;

  if (currentVersion < 1) {
    migration1_initialSchema(db);
  }

  if (currentVersion < 2) {
    migration2_addQaPdfPath(db);
  }

  if (currentVersion < 3) {
    migration3_applyAutomation(db);
  }
}

/**
 * Migration 1: Initial schema (profiles, jobs, generations)
 */
function migration1_initialSchema(db: Database.Database): void {
  db.exec(`
    -- Profiles table
    CREATE TABLE IF NOT EXISTS profiles (
      profile_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rules_text TEXT NOT NULL,
      template_html TEXT NOT NULL,
      rules_hash TEXT NOT NULL,
      template_hash TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT NULL
    );

    -- Jobs table
    CREATE TABLE IF NOT EXISTS jobs (
      job_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      jd_text TEXT NOT NULL,
      jd_hash TEXT NOT NULL,
      source_url TEXT NULL,
      company_name TEXT NULL,
      job_title TEXT NULL,
      job_type TEXT NULL,
      budget TEXT NULL,
      required_tech_stack TEXT NULL,
      job_description_clean TEXT NULL,
      contact_email TEXT NULL,
      contact_phone TEXT NULL,
      follow_up_links_json TEXT NULL,
      contact_source_text TEXT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_company_name ON jobs(company_name);
    CREATE INDEX IF NOT EXISTS idx_jobs_job_title ON jobs(job_title);
    CREATE INDEX IF NOT EXISTS idx_jobs_jd_hash ON jobs(jd_hash);

    -- Generations table
    CREATE TABLE IF NOT EXISTS generations (
      generation_id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      rules_hash TEXT NOT NULL,
      template_hash TEXT NOT NULL,
      jd_model_used TEXT NOT NULL,
      payload_model_used TEXT NOT NULL,
      fallback_used INTEGER NOT NULL DEFAULT 0,
      fallback_reason TEXT NULL,
      jd_input_tokens INTEGER NULL,
      jd_cached_input_tokens INTEGER NULL,
      jd_output_tokens INTEGER NULL,
      payload_input_tokens INTEGER NULL,
      payload_cached_input_tokens INTEGER NULL,
      payload_output_tokens INTEGER NULL,
      total_estimated_cost_usd REAL NULL,
      base_folder TEXT NOT NULL,
      company_folder TEXT NOT NULL,
      role_folder TEXT NOT NULL,
      profile_folder TEXT NOT NULL,
      output_dir TEXT NOT NULL,
      resume_pdf_path TEXT NULL,
      cover_pdf_path TEXT NULL,
      jd_txt_path TEXT NULL,
      error_code TEXT NULL,
      error_message TEXT NULL,
      raw_model_output_snippet TEXT NULL,
      FOREIGN KEY (job_id) REFERENCES jobs(job_id),
      FOREIGN KEY (profile_id) REFERENCES profiles(profile_id)
    );

    CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at);
    CREATE INDEX IF NOT EXISTS idx_generations_job_id ON generations(job_id);
    CREATE INDEX IF NOT EXISTS idx_generations_profile_id ON generations(profile_id);
    CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);
  `);

  db.pragma(`user_version = ${CURRENT_VERSION}`);
}

/**
 * Migration 2: Add qa_pdf_path column to generations table
 */
function migration2_addQaPdfPath(db: Database.Database): void {
  // Check if column already exists (idempotent migration)
  const tableInfo = db.prepare("PRAGMA table_info(generations)").all() as Array<{ name: string }>;
  const hasQaPdfPath = tableInfo.some((col) => col.name === 'qa_pdf_path');

  if (!hasQaPdfPath) {
    db.exec(`ALTER TABLE generations ADD COLUMN qa_pdf_path TEXT NULL`);
  }

  db.pragma(`user_version = 2`);
}

/**
 * Migration 3: Apply Automation (applicant_profiles, autofill_answers, profiles.applicant_id, jobs.normalized_url/platform_id)
 */
function migration3_applyAutomation(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS applicant_profiles (
      applicant_id TEXT PRIMARY KEY,
      name TEXT,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      phone TEXT,
      address1 TEXT,
      address2 TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      country TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS autofill_answers (
      applicant_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      updated_at TEXT,
      PRIMARY KEY (applicant_id, key)
    );
  `);

  const profilesInfo = db.prepare('PRAGMA table_info(profiles)').all() as Array<{ name: string }>;
  if (!profilesInfo.some((c) => c.name === 'applicant_id')) {
    db.exec('ALTER TABLE profiles ADD COLUMN applicant_id TEXT');
  }

  let jobsInfo = db.prepare('PRAGMA table_info(jobs)').all() as Array<{ name: string }>;
  if (!jobsInfo.some((c) => c.name === 'normalized_url')) {
    db.exec('ALTER TABLE jobs ADD COLUMN normalized_url TEXT');
  }
  jobsInfo = db.prepare('PRAGMA table_info(jobs)').all() as Array<{ name: string }>;
  if (!jobsInfo.some((c) => c.name === 'platform_id')) {
    db.exec('ALTER TABLE jobs ADD COLUMN platform_id TEXT');
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_jobs_normalized_url ON jobs(normalized_url)');

  db.pragma('user_version = 3');
}
