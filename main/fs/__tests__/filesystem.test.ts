import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ensureDir,
  versionedFilePath,
  computeBaseFolder,
  buildOutputDirectory,
  extractOwnerFirstName,
  generateOutputFilePaths,
} from '../filesystem';
import { sha256, hashShort } from '../../../shared/utils';

describe('filesystem', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-tailor-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('ensureDir', () => {
    it('creates directory if it does not exist', () => {
      const testDir = path.join(tempDir, 'test', 'nested');
      ensureDir(testDir);
      expect(fs.existsSync(testDir)).toBe(true);
    });

    it('does not error if directory exists', () => {
      const testDir = path.join(tempDir, 'test');
      fs.mkdirSync(testDir, { recursive: true });
      expect(() => ensureDir(testDir)).not.toThrow();
    });
  });

  describe('versionedFilePath', () => {
    it('returns original path if file does not exist', () => {
      const filePath = path.join(tempDir, 'test.txt');
      expect(versionedFilePath(filePath)).toBe(filePath);
    });

    it('returns _v2 if file exists', () => {
      const basePath = path.join(tempDir, 'test.txt');
      fs.writeFileSync(basePath, 'content');
      const versioned = versionedFilePath(basePath);
      expect(versioned).toBe(path.join(tempDir, 'test_v2.txt'));
    });

    it('returns _v3 if _v2 exists', () => {
      const basePath = path.join(tempDir, 'test.txt');
      fs.writeFileSync(basePath, 'content');
      fs.writeFileSync(path.join(tempDir, 'test_v2.txt'), 'content');
      const versioned = versionedFilePath(basePath);
      expect(versioned).toBe(path.join(tempDir, 'test_v3.txt'));
    });
  });

  describe('computeBaseFolder', () => {
    it('formats date as YYYY_MM_DD', () => {
      const date = new Date('2026-02-12T00:00:00Z');
      const result = computeBaseFolder(date);
      expect(result).toMatch(/^\d{4}_\d{2}_\d{2}$/);
    });
  });

  describe('buildOutputDirectory', () => {
    it('creates directory structure', () => {
      const result = buildOutputDirectory({
        outputRootPath: tempDir,
        baseFolder: '2026_02_12',
        companyName: 'Test Company',
        jobTitle: 'Software Engineer',
        profileName: 'Default Profile',
        jdHash: sha256('test jd'),
      });

      expect(fs.existsSync(result.outputDir)).toBe(true);
      expect(result.outputDir).toContain('Test Company');
      expect(result.outputDir).toContain('Software Engineer');
      expect(result.outputDir).toContain('Default Profile');
      expect(result.base_folder).toBe('2026_02_12');
      expect(result.company_folder).toContain('Test');
      expect(result.role_folder).toContain('Software');
      expect(result.profile_folder).toContain('Default');
    });

    it('uses not_specified fallback for missing company', () => {
      const jdHash = sha256('test jd');
      const result = buildOutputDirectory({
        outputRootPath: tempDir,
        baseFolder: '2026_02_12',
        companyName: null,
        jobTitle: 'Software Engineer',
        profileName: 'Default Profile',
        jdHash,
      });

      expect(result.outputDir).toContain('not_specified_');
      expect(result.outputDir).toContain(hashShort(jdHash, 8));
    });

    it('handles collisions by appending hash', () => {
      const jdHash1 = sha256('test jd 1');
      const jdHash2 = sha256('test jd 2');

      const result1 = buildOutputDirectory({
        outputRootPath: tempDir,
        baseFolder: '2026_02_12',
        companyName: 'Acme',
        jobTitle: 'Engineer',
        profileName: 'Default',
        jdHash: jdHash1,
      });

      const result2 = buildOutputDirectory({
        outputRootPath: tempDir,
        baseFolder: '2026_02_12',
        companyName: 'Acme',
        jobTitle: 'Engineer',
        profileName: 'Default',
        jdHash: jdHash2,
      });

      expect(result1.outputDir).not.toBe(result2.outputDir);
      expect(result2.outputDir).toContain('__');
      expect(result2.outputDir).toContain('Engineer__');
    });
  });

  describe('extractOwnerFirstName', () => {
    it('extracts first name from "First Name: Tan"', () => {
      const rules = 'First Name: Tan\nOther content';
      expect(extractOwnerFirstName(rules)).toBe('Tan');
    });

    it('extracts first name from "Name: John"', () => {
      const rules = 'Name: John\nOther content';
      expect(extractOwnerFirstName(rules)).toBe('John');
    });

    it('returns default if not found', () => {
      const rules = 'Some other content without name';
      expect(extractOwnerFirstName(rules)).toBe('Resume');
    });
  });

  describe('generateOutputFilePaths', () => {
    it('generates versioned file paths', () => {
      const paths = generateOutputFilePaths({
        outputDir: tempDir,
        ownerFirstName: 'Tan',
      });

      expect(paths.resumePdfPath).toBe(path.join(tempDir, 'Tan_Resume.pdf'));
      expect(paths.coverPdfPath).toBe(path.join(tempDir, 'Tan_CoverLetter.pdf'));
      expect(paths.jdTxtPath).toBe(path.join(tempDir, 'JD.txt'));
    });

    it('versions files if they exist', () => {
      const resumePath = path.join(tempDir, 'Tan_Resume.pdf');
      fs.writeFileSync(resumePath, 'content');

      const paths = generateOutputFilePaths({
        outputDir: tempDir,
        ownerFirstName: 'Tan',
      });

      expect(paths.resumePdfPath).toBe(path.join(tempDir, 'Tan_Resume_v2.pdf'));
    });
  });
});
