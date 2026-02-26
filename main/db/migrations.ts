import type Database from 'better-sqlite3';

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

  // Migration 3 adds base_resume_text + profile_prompts. Some existing DBs may already have
  // user_version = 3 from an earlier build but still be missing profile_prompts, so we also
  // check for the table's existence and run the migration if it's missing.
  const needsMigration3 =
    currentVersion < 3 ||
    !db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'profile_prompts'"
      )
      .get();
  if (needsMigration3) {
    migration3_addBaseResumeAndPrompts(db);
  }

  if (currentVersion < 4) {
    migration4_addGenerationPromptId(db);
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

  // Initial schema version is 1; later migrations bump this.
  db.pragma('user_version = 1');
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

  db.pragma('user_version = 2');
}

/**
 * Migration 3: Add base_resume_text to profiles and create profile_prompts table.
 */
function migration3_addBaseResumeAndPrompts(db: Database.Database): void {
  // 1) Add base_resume_text to profiles if missing
  const profilesInfo = db.prepare('PRAGMA table_info(profiles)').all() as Array<{ name: string }>;
  const hasBaseResume = profilesInfo.some((col) => col.name === 'base_resume_text');
  if (!hasBaseResume) {
    db.exec(`ALTER TABLE profiles ADD COLUMN base_resume_text TEXT NOT NULL DEFAULT ''`);
  }

  // 2) Create profile_prompts table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile_prompts (
      prompt_id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      name TEXT NOT NULL,
      prompt_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT NULL,
      FOREIGN KEY (profile_id) REFERENCES profiles(profile_id)
    );

    CREATE INDEX IF NOT EXISTS idx_prompts_profile_id ON profile_prompts(profile_id);
  `);

  db.pragma('user_version = 3');
}

/**
 * Migration 4: Add prompt_id to generations (which prompt was used for this run).
 */
function migration4_addGenerationPromptId(db: Database.Database): void {
  const tableInfo = db.prepare('PRAGMA table_info(generations)').all() as Array<{ name: string }>;
  if (!tableInfo.some((col) => col.name === 'prompt_id')) {
    db.exec(`ALTER TABLE generations ADD COLUMN prompt_id TEXT NULL`);
  }
  db.pragma('user_version = 4');
}
