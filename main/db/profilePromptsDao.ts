import { randomUUID } from 'crypto';
import { getDatabase } from './database';
import type { ProfilePrompt } from '../../shared/types';

export function listPromptsForProfile(profileId: string): ProfilePrompt[] {
  const db = getDatabase();
  const stmt = db.prepare<ProfilePrompt['profile_id']>(
    `SELECT * FROM profile_prompts WHERE profile_id = ? AND archived_at IS NULL ORDER BY created_at ASC`
  );
  return stmt.all(profileId) as ProfilePrompt[];
}

export function getPrompt(promptId: string): ProfilePrompt | null {
  const db = getDatabase();
  const stmt = db.prepare<ProfilePrompt['prompt_id']>(
    `SELECT * FROM profile_prompts WHERE prompt_id = ?`
  );
  const row = stmt.get(promptId) as ProfilePrompt | undefined;
  return row ?? null;
}

export function createPrompt(data: {
  profile_id: string;
  name: string;
  prompt_text: string;
}): ProfilePrompt {
  const db = getDatabase();
  const promptId = randomUUID();
  const now = new Date().toISOString();

  const stmt = db.prepare(
    `INSERT INTO profile_prompts (prompt_id, profile_id, name, prompt_text, created_at, updated_at, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`
  );

  stmt.run(promptId, data.profile_id, data.name, data.prompt_text, now, now);

  return getPrompt(promptId)!;
}

export function updatePrompt(
  promptId: string,
  data: Partial<{ name: string; prompt_text: string }>
): ProfilePrompt {
  const db = getDatabase();
  const current = getPrompt(promptId);
  if (!current) {
    throw new Error(`Prompt ${promptId} not found`);
  }
  const now = new Date().toISOString();

  const stmt = db.prepare(
    `UPDATE profile_prompts
     SET name = COALESCE(?, name),
         prompt_text = COALESCE(?, prompt_text),
         updated_at = ?
     WHERE prompt_id = ?`
  );

  stmt.run(
    data.name ?? null,
    data.prompt_text ?? null,
    now,
    promptId
  );

  return getPrompt(promptId)!;
}

export function archivePrompt(promptId: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `UPDATE profile_prompts
     SET archived_at = ?
     WHERE prompt_id = ?`
  );
  stmt.run(now, promptId);
}

