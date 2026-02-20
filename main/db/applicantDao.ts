import { getDatabase } from './database';
import { randomUUID } from 'crypto';

export type ApplicantProfileRow = {
  applicant_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AutofillAnswerRow = { key: string; value: string | null };

export type ApplicantProfileInput = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
};

/**
 * Get applicant profile by applicant_id. Returns null if not found.
 */
export function getApplicantProfile(applicantId: string): ApplicantProfileRow | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM applicant_profiles WHERE applicant_id = ?');
  const row = stmt.get(applicantId) as ApplicantProfileRow | undefined;
  return row || null;
}

/**
 * Get all autofill answers for an applicant. Returns key-value map.
 */
export function getAutofillAnswers(applicantId: string): Record<string, string> {
  const db = getDatabase();
  const stmt = db.prepare('SELECT key, value FROM autofill_answers WHERE applicant_id = ?');
  const rows = stmt.all(applicantId) as AutofillAnswerRow[];
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.value != null) out[r.key] = r.value;
  }
  return out;
}

/**
 * Create a new applicant profile. Returns the new applicant_id.
 */
export function createApplicantProfile(data: ApplicantProfileInput): string {
  const db = getDatabase();
  const applicantId = randomUUID();
  const now = new Date().toISOString();
  const name = [data.first_name ?? '', data.last_name ?? ''].filter(Boolean).join(' ') || null;
  const stmt = db.prepare(`
    INSERT INTO applicant_profiles (
      applicant_id, name, first_name, last_name, email, phone,
      address1, address2, city, state, zip, country,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    applicantId,
    name,
    data.first_name ?? null,
    data.last_name ?? null,
    data.email ?? null,
    data.phone ?? null,
    data.address1 ?? null,
    data.address2 ?? null,
    data.city ?? null,
    data.state ?? null,
    data.zip ?? null,
    data.country ?? null,
    now,
    now
  );
  return applicantId;
}

/**
 * Update an existing applicant profile.
 */
export function updateApplicantProfile(applicantId: string, data: ApplicantProfileInput): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  const name = [data.first_name ?? '', data.last_name ?? ''].filter(Boolean).join(' ') || null;
  const stmt = db.prepare(`
    UPDATE applicant_profiles
    SET name = ?, first_name = ?, last_name = ?, email = ?, phone = ?,
        address1 = ?, address2 = ?, city = ?, state = ?, zip = ?, country = ?,
        updated_at = ?
    WHERE applicant_id = ?
  `);
  stmt.run(
    name,
    data.first_name ?? null,
    data.last_name ?? null,
    data.email ?? null,
    data.phone ?? null,
    data.address1 ?? null,
    data.address2 ?? null,
    data.city ?? null,
    data.state ?? null,
    data.zip ?? null,
    data.country ?? null,
    now,
    applicantId
  );
}

/**
 * Replace all autofill answers for an applicant with the given key-value map.
 */
export function setAutofillAnswers(applicantId: string, answers: Record<string, string>): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare('DELETE FROM autofill_answers WHERE applicant_id = ?').run(applicantId);
  const insert = db.prepare(`
    INSERT INTO autofill_answers (applicant_id, key, value, updated_at) VALUES (?, ?, ?, ?)
  `);
  for (const [key, value] of Object.entries(answers)) {
    if (key.trim() === '') continue;
    insert.run(applicantId, key.trim(), value.trim(), now);
  }
}
