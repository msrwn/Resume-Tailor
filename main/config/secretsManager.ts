import * as keytar from 'keytar';

const SERVICE_NAME = 'resume-tailor';
const ACCOUNT_NAME = 'openai-api-key';

/**
 * Set API key in OS keychain.
 */
export async function setApiKey(key: string): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, key);
}

/**
 * Get API key from OS keychain.
 */
export async function getApiKey(): Promise<string | null> {
  return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
}

/**
 * Check if API key exists.
 */
export async function hasApiKey(): Promise<boolean> {
  const key = await getApiKey();
  return key !== null;
}

/**
 * Clear API key from OS keychain.
 */
export async function clearApiKey(): Promise<boolean> {
  return await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
}
