import { getDatabase } from './database';
import { randomUUID } from 'crypto';
import { sha256 } from '../../shared/utils';
import type { Profile } from '../../shared/types';

/**
 * Get all non-archived profiles.
 */
export function listProfiles(): Profile[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM profiles
    WHERE archived_at IS NULL
    ORDER BY created_at DESC
  `);
  return stmt.all() as Profile[];
}

/**
 * Get profile by ID.
 */
export function getProfile(profileId: string): Profile | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM profiles WHERE profile_id = ?');
  const result = stmt.get(profileId) as Profile | undefined;
  return result || null;
}

/**
 * Get default profile.
 */
export function getDefaultProfile(): Profile | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM profiles WHERE is_default = 1 AND archived_at IS NULL LIMIT 1');
  const result = stmt.get() as Profile | undefined;
  return result || null;
}

/**
 * Create a new profile.
 */
export function createProfile(data: {
  name: string;
  rules_text: string;
  base_resume_text: string;
  template_html: string;
  is_default?: boolean;
}): Profile {
  const db = getDatabase();
  const profileId = randomUUID();
  const now = new Date().toISOString();
  const rulesHash = sha256(data.rules_text);
  const templateHash = sha256(data.template_html);

  // If this is default, unset other defaults
  if (data.is_default) {
    const unsetDefault = db.prepare('UPDATE profiles SET is_default = 0 WHERE is_default = 1');
    unsetDefault.run();
  }

  const stmt = db.prepare(`
    INSERT INTO profiles (
      profile_id, name, rules_text, base_resume_text, template_html, rules_hash, template_hash,
      is_default, created_at, updated_at, archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `);

  stmt.run(
    profileId,
    data.name,
    data.rules_text,
    data.base_resume_text,
    data.template_html,
    rulesHash,
    templateHash,
    data.is_default ? 1 : 0,
    now,
    now
  );

  return getProfile(profileId)!;
}

/**
 * Update a profile.
 */
export function updateProfile(profileId: string, data: Partial<{
  name: string;
  rules_text: string;
  base_resume_text: string;
  template_html: string;
  is_default: boolean;
}>): Profile {
  const db = getDatabase();
  const now = new Date().toISOString();

  const current = getProfile(profileId);
  if (!current) {
    throw new Error(`Profile ${profileId} not found`);
  }

  // If setting as default, unset other defaults
  if (data.is_default) {
    const unsetDefault = db.prepare('UPDATE profiles SET is_default = 0 WHERE is_default = 1 AND profile_id != ?');
    unsetDefault.run(profileId);
  }

  // Compute hashes if rules or template changed
  const rulesText = data.rules_text ?? current.rules_text;
  const templateHtml = data.template_html ?? current.template_html;
  const rulesHash = sha256(rulesText);
  const templateHash = sha256(templateHtml);

  const stmt = db.prepare(`
    UPDATE profiles
    SET name = COALESCE(?, name),
        rules_text = COALESCE(?, rules_text),
        base_resume_text = COALESCE(?, base_resume_text),
        template_html = COALESCE(?, template_html),
        rules_hash = ?,
        template_hash = ?,
        is_default = COALESCE(?, is_default),
        updated_at = ?
    WHERE profile_id = ?
  `);

  stmt.run(
    data.name ?? null,
    data.rules_text ?? null,
    data.base_resume_text ?? null,
    data.template_html ?? null,
    rulesHash,
    templateHash,
    data.is_default !== undefined ? (data.is_default ? 1 : 0) : null,
    now,
    profileId
  );

  return getProfile(profileId)!;
}

/**
 * Archive a profile (soft delete).
 */
export function archiveProfile(profileId: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  // If archiving default, we need to set another as default
  const profile = getProfile(profileId);
  if (profile?.is_default) {
    // Find another profile to make default
    const otherProfiles = db.prepare(`
      SELECT profile_id FROM profiles
      WHERE profile_id != ? AND archived_at IS NULL
      LIMIT 1
    `).get(profileId) as { profile_id: string } | undefined;

    if (otherProfiles) {
      const setDefault = db.prepare('UPDATE profiles SET is_default = 1 WHERE profile_id = ?');
      setDefault.run(otherProfiles.profile_id);
    }
  }

  const stmt = db.prepare('UPDATE profiles SET archived_at = ? WHERE profile_id = ?');
  stmt.run(now, profileId);
}

/**
 * Set a profile as default.
 */
export function setDefaultProfile(profileId: string): void {
  const db = getDatabase();
  const unsetDefault = db.prepare('UPDATE profiles SET is_default = 0 WHERE is_default = 1');
  const setDefault = db.prepare('UPDATE profiles SET is_default = 1 WHERE profile_id = ?');

  db.transaction(() => {
    unsetDefault.run();
    setDefault.run(profileId);
  })();
}
