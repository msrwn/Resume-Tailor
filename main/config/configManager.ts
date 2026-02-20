import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { AppConfig } from '@shared/types';

const CONFIG_FILENAME = 'config.json';

const DEFAULT_CONFIG: AppConfig = {
  useDateBaseFolder: true,
  dateFolderFormat: 'YYYY_MM_DD',
  retryCountCallA: 1,
  retryCountCallB: 1,
  fallbackEnabled: true,
};

let configCache: AppConfig | null = null;

function getConfigPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

/**
 * Read config from disk, merging with defaults.
 */
export function readConfig(): AppConfig {
  if (configCache) {
    return configCache;
  }

  const configPath = getConfigPath();
  let config: Partial<AppConfig> = {};

  try {
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf-8');
      config = JSON.parse(fileContent);
    }
  } catch (error) {
    console.error('Failed to read config:', error);
  }

  // Merge with defaults
  configCache = { ...DEFAULT_CONFIG, ...config };
  return configCache;
}

/**
 * Write config to disk atomically (write temp file then rename).
 */
export function writeConfig(config: Partial<AppConfig>): void {
  const configPath = getConfigPath();
  const currentConfig = readConfig();
  const newConfig: AppConfig = { ...currentConfig, ...config };

  // Ensure directory exists
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Write atomically: write to temp file, then rename
  const tempPath = `${configPath}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(newConfig, null, 2), 'utf-8');
    fs.renameSync(tempPath, configPath);
    configCache = newConfig;
  } catch (error) {
    console.error('Failed to write config:', error);
    // Clean up temp file if rename failed
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw error;
  }
}

/**
 * Clear config cache (useful for testing).
 */
export function clearConfigCache(): void {
  configCache = null;
}

/**
 * Get default config (for testing/initialization).
 */
export function getDefaultConfig(): AppConfig {
  return { ...DEFAULT_CONFIG };
}
