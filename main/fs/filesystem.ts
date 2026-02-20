import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { sanitizePathSegment, formatDateFolder, hashShort } from '../../shared/utils';

/**
 * Ensure directory exists, creating it recursively if needed.
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get versioned file path (adds _v2, _v3, etc. if file exists).
 */
export function versionedFilePath(basePath: string): string {
  const dir = path.dirname(basePath);
  const ext = path.extname(basePath);
  const nameWithoutExt = path.basename(basePath, ext);

  let version = 1;
  let filePath = basePath;

  while (fs.existsSync(filePath)) {
    version++;
    const versionedName = `${nameWithoutExt}_v${version}${ext}`;
    filePath = path.join(dir, versionedName);
  }

  return filePath;
}

/**
 * Compute base folder using America/Los_Angeles timezone.
 */
export function computeBaseFolder(date: Date = new Date()): string {
  return formatDateFolder(date);
}

export type BuildOutputDirectoryResult = {
  outputDir: string;
  base_folder: string;
  company_folder: string;
  role_folder: string;
  profile_folder: string;
};

/**
 * Build output directory path with collision detection.
 * Returns full path and folder components for DB storage.
 */
export function buildOutputDirectory(params: {
  outputRootPath: string;
  baseFolder: string;
  companyName: string | null;
  jobTitle: string | null;
  profileName: string;
  jdHash: string;
}): BuildOutputDirectoryResult {
  const { outputRootPath, baseFolder, companyName, jobTitle, profileName, jdHash } = params;

  const jdHashShort = hashShort(jdHash, 8);

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const baseCompanyFolder = companyName
    ? sanitizePathSegment(companyName)
    : `not_specified_${jdHashShort}`;
  const companyFolder = isDev ? `${baseCompanyFolder}_Development_Mode` : baseCompanyFolder;

  let roleFolder = jobTitle ? sanitizePathSegment(jobTitle) : `not_specified_${jdHashShort}`;
  const profileFolder = sanitizePathSegment(profileName);

  let outputDir = path.join(outputRootPath, baseFolder, companyFolder, roleFolder, profileFolder);

  if (fs.existsSync(outputDir)) {
    const hashFile = path.join(outputDir, '.jd_hash');
    if (fs.existsSync(hashFile)) {
      const existingHash = fs.readFileSync(hashFile, 'utf-8').trim();
      if (existingHash !== jdHash) {
        roleFolder = `${roleFolder}__${jdHashShort}`;
        outputDir = path.join(outputRootPath, baseFolder, companyFolder, roleFolder, profileFolder);
      }
    }
  }

  ensureDir(outputDir);
  const hashFile = path.join(outputDir, '.jd_hash');
  fs.writeFileSync(hashFile, jdHash, 'utf-8');

  return {
    outputDir,
    base_folder: baseFolder,
    company_folder: companyFolder,
    role_folder: roleFolder,
    profile_folder: profileFolder,
  };
}

/**
 * Extract owner first name from profile rules text.
 * Looks for patterns like "First Name: Tan" or "Name: Tan".
 */
export function extractOwnerFirstName(rulesText: string): string {
  // Try common patterns
  const patterns = [
    /First\s+Name[:\s]+(\w+)/i,
    /Name[:\s]+(\w+)/i,
    /Owner[:\s]+(\w+)/i,
    /Personal\s+Information[:\s]*\n[^:]*First\s+Name[:\s]+(\w+)/i,
  ];

  for (const pattern of patterns) {
    const match = rulesText.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Default fallback
  return 'Resume';
}

/**
 * Generate output file paths with versioning.
 */
export function generateOutputFilePaths(params: {
  outputDir: string;
  ownerFirstName: string;
}): {
  resumePdfPath: string;
  coverPdfPath: string;
  jdTxtPath: string;
  qaPdfPath: string;
} {
  const { outputDir, ownerFirstName } = params;

  const resumePdfPath = versionedFilePath(path.join(outputDir, `${ownerFirstName}_Resume.pdf`));
  const coverPdfPath = versionedFilePath(path.join(outputDir, `${ownerFirstName}_CoverLetter.pdf`));
  const jdTxtPath = versionedFilePath(path.join(outputDir, 'JD.txt'));
  const qaPdfPath = versionedFilePath(path.join(outputDir, `${ownerFirstName}_QA.pdf`));

  return {
    resumePdfPath,
    coverPdfPath,
    jdTxtPath,
    qaPdfPath,
  };
}
