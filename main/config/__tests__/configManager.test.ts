import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock electron before importing configManager
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(),
  },
}));

import { readConfig, writeConfig, clearConfigCache, getDefaultConfig } from '../configManager';
import { app } from 'electron';

describe('configManager', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create temp directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-tailor-test-'));
    
    // Mock app.getPath('userData')
    (app.getPath as jest.Mock).mockReturnValue(tempDir);
    
    clearConfigCache();
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    clearConfigCache();
  });

  describe('readConfig', () => {
    it('returns default config when file does not exist', () => {
      const config = readConfig();
      expect(config.useDateBaseFolder).toBe(true);
      expect(config.dateFolderFormat).toBe('YYYY_MM_DD');
      expect(config.retryCountCallA).toBe(1);
      expect(config.retryCountCallB).toBe(1);
      expect(config.fallbackEnabled).toBe(true);
    });

    it('merges existing config with defaults', () => {
      const configPath = path.join(tempDir, 'config.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({ outputRootPath: '/test/path', retryCountCallA: 3 })
      );

      const config = readConfig();
      expect(config.outputRootPath).toBe('/test/path');
      expect(config.retryCountCallA).toBe(3);
      expect(config.useDateBaseFolder).toBe(true); // from defaults
    });
  });

  describe('writeConfig', () => {
    it('writes config atomically', () => {
      const configPath = path.join(tempDir, 'config.json');
      
      writeConfig({ outputRootPath: '/test/path' });
      
      expect(fs.existsSync(configPath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(content.outputRootPath).toBe('/test/path');
    });

    it('merges partial config with existing', () => {
      const configPath = path.join(tempDir, 'config.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({ outputRootPath: '/old/path', retryCountCallA: 2 })
      );

      clearConfigCache();
      writeConfig({ retryCountCallA: 5 });

      const config = readConfig();
      expect(config.outputRootPath).toBe('/old/path');
      expect(config.retryCountCallA).toBe(5);
    });

    it('creates directory if it does not exist', () => {
      const nestedDir = path.join(tempDir, 'nested', 'dir');
      (app.getPath as jest.Mock).mockReturnValue(nestedDir);
      clearConfigCache();

      writeConfig({ outputRootPath: '/test' });

      expect(fs.existsSync(nestedDir)).toBe(true);
    });
  });

  describe('getDefaultConfig', () => {
    it('returns a copy of default config', () => {
      const config1 = getDefaultConfig();
      const config2 = getDefaultConfig();
      
      expect(config1).toEqual(config2);
      config1.outputRootPath = '/test';
      expect(config2.outputRootPath).toBeUndefined();
    });
  });
});
