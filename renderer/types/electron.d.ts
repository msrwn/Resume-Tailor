// Type definitions for Electron API exposed via preload script
import type { AppConfig, Profile, ProfilePrompt, Job, Generation, CallAOutput, CallBOutput } from '@shared/types';

export interface ElectronAPI {
  // App info
  getVersion: () => Promise<string>;
  getAppDataPath: () => Promise<string>;
  getChangelog: () => Promise<{ success: boolean; content?: string; error?: string }>;

  // Config
  configGet: () => Promise<AppConfig>;
  configSet: (config: Partial<AppConfig>) => Promise<{ success: boolean; error?: string }>;

  // Secrets
  secretsSetKey: (key: string) => Promise<{ success: boolean; error?: string }>;
  secretsGetKey: () => Promise<{ success: boolean; key?: string | null; error?: string }>;
  secretsHasKey: () => Promise<{ success: boolean; exists: boolean; error?: string }>;
  secretsClearKey: () => Promise<{ success: boolean; error?: string }>;

  // Dialogs
  dialogSelectFolder: () => Promise<{ success: boolean; path?: string; canceled?: boolean }>;

  // Database
  dbInit: () => Promise<{ success: boolean; error?: string }>;

  // Profiles
  profilesList: () => Promise<{ success: boolean; profiles?: Profile[]; error?: string }>;
  profilesGet: (profileId: string) => Promise<{ success: boolean; profile?: Profile | null; error?: string }>;
  profilesGetDefault: () => Promise<{ success: boolean; profile?: Profile | null; error?: string }>;
  profilesCreate: (data: { name: string; rules_text: string; base_resume_text: string; template_html: string; is_default?: boolean }) => Promise<{ success: boolean; profile?: Profile; error?: string }>;
  profilesUpdate: (profileId: string, data: Partial<{ name: string; rules_text: string; base_resume_text: string; template_html: string; is_default: boolean }>) => Promise<{ success: boolean; profile?: Profile; error?: string }>;
  profilesSetDefault: (profileId: string) => Promise<{ success: boolean; error?: string }>;
  profilesArchive: (profileId: string) => Promise<{ success: boolean; error?: string }>;
  profilePromptsList: (profileId: string) => Promise<{ success: boolean; prompts?: ProfilePrompt[]; error?: string }>;
  profilePromptsCreate: (data: { profile_id: string; name: string; prompt_text: string }) => Promise<{ success: boolean; prompt?: ProfilePrompt; error?: string }>;
  profilePromptsUpdate: (promptId: string, data: Partial<{ name: string; prompt_text: string }>) => Promise<{ success: boolean; prompt?: ProfilePrompt; error?: string }>;
  profilePromptsArchive: (promptId: string) => Promise<{ success: boolean; error?: string }>;
  profilesValidate: (data: { rules_text: string; template_html: string }) => Promise<{ success: boolean; valid?: boolean; errors?: string[]; error?: string }>;

  // Jobs
  jobsGet: (jobId: string) => Promise<{ success: boolean; job?: Job | null; error?: string }>;
  jobsCreate: (data: { jd_text: string; source_url?: string }) => Promise<{ success: boolean; job?: Job; error?: string }>;

  // History
  historyList: (query?: { company_name?: string; job_title?: string; keyword?: string; profile_id?: string; limit?: number; offset?: number }) => Promise<{
    success: boolean;
    results?: Array<{ job: Job; generation: Generation | null; profileName: string | null }>;
    error?: string;
  }>;
  historyGetCounts: () => Promise<{ success: boolean; total?: number; today?: number; error?: string }>;

  // Generations
  generationGet: (generationId: string) => Promise<{ success: boolean; generation?: Generation | null; error?: string }>;
  generationGetLatestForJob: (jobId: string) => Promise<{ success: boolean; generation?: Generation | null; error?: string }>;
  generationRunCallA: (params: { jdText: string; sourceUrl?: string; profileId: string }) => Promise<{
    success: boolean;
    jobId?: string;
    job?: Job | null;
    error?: string;
    rawResponse?: string;
    extraction?: CallAOutput;
  }>;
  generationRunFull: (params: { jdText: string; sourceUrl?: string; profileId?: string; profileIds?: string[]; promptId?: string; questions?: string[]; taskId?: number }) => Promise<{
    success: boolean;
    jobId?: string;
    generationId?: string;
    job?: Job | null;
    extraction?: CallAOutput;
    callBOutput?: CallBOutput;
    results?: import('@shared/types').GenerationProfileResult[];
    error?: string;
    rawResponse?: string;
    validationErrors?: string[];
    outputDir?: string;
    resumePdfPath?: string | null;
    coverPdfPath?: string | null;
    jdTxtPath?: string | null;
    qaPdfPath?: string | null;
  }>;
  onGenerationProgress: (callback: (data: { taskId?: number; step: string; message: string; percent: number }) => void) => () => void;
  filesOpenFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
  filesOpenFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  filesOpenUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
