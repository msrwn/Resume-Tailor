import { contextBridge, ipcRenderer } from 'electron';
import type { AppConfig, Profile, ProfilePrompt, Job, Generation } from '@shared/types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getAppDataPath: () => ipcRenderer.invoke('app:getAppDataPath'),
  getChangelog: () =>
    ipcRenderer.invoke('app:getChangelog') as Promise<{ success: boolean; content?: string; error?: string }>,

  // Config
  configGet: () => ipcRenderer.invoke('config:get') as Promise<AppConfig>,
  configSet: (config: Partial<AppConfig>) =>
    ipcRenderer.invoke('config:set', config) as Promise<{ success: boolean; error?: string }>,

  // Secrets
  secretsSetKey: (key: string) =>
    ipcRenderer.invoke('secrets:setKey', key) as Promise<{ success: boolean; error?: string }>,
  secretsGetKey: () =>
    ipcRenderer.invoke('secrets:getKey') as Promise<{ success: boolean; key?: string | null; error?: string }>,
  secretsHasKey: () =>
    ipcRenderer.invoke('secrets:hasKey') as Promise<{ success: boolean; exists: boolean; error?: string }>,
  secretsClearKey: () =>
    ipcRenderer.invoke('secrets:clearKey') as Promise<{ success: boolean; error?: string }>,

  // Dialogs
  dialogSelectFolder: () =>
    ipcRenderer.invoke('dialog:selectFolder') as Promise<{ success: boolean; path?: string; canceled?: boolean }>,

  // Database
  dbInit: () => ipcRenderer.invoke('db:init') as Promise<{ success: boolean; error?: string }>,

  // Profiles
  profilesList: () =>
    ipcRenderer.invoke('profiles:list') as Promise<{ success: boolean; profiles?: Profile[]; error?: string }>,
  profilesGet: (profileId: string) =>
    ipcRenderer.invoke('profiles:get', profileId) as Promise<{ success: boolean; profile?: Profile | null; error?: string }>,
  profilesGetDefault: () =>
    ipcRenderer.invoke('profiles:getDefault') as Promise<{ success: boolean; profile?: Profile | null; error?: string }>,
  profilesCreate: (data: { name: string; rules_text: string; base_resume_text: string; template_html: string; is_default?: boolean }) =>
    ipcRenderer.invoke('profiles:create', data) as Promise<{ success: boolean; profile?: Profile; error?: string }>,
  profilesUpdate: (profileId: string, data: Partial<{ name: string; rules_text: string; base_resume_text: string; template_html: string; is_default: boolean }>) =>
    ipcRenderer.invoke('profiles:update', profileId, data) as Promise<{ success: boolean; profile?: Profile; error?: string }>,
  profilesSetDefault: (profileId: string) =>
    ipcRenderer.invoke('profiles:setDefault', profileId) as Promise<{ success: boolean; error?: string }>,
  profilesArchive: (profileId: string) =>
    ipcRenderer.invoke('profiles:archive', profileId) as Promise<{ success: boolean; error?: string }>,
  profilesValidate: (data: { rules_text: string; template_html: string }) =>
    ipcRenderer.invoke('profiles:validate', data) as Promise<{ success: boolean; valid?: boolean; errors?: string[]; error?: string }>,

  // Profile prompts
  profilePromptsList: (profileId: string) =>
    ipcRenderer.invoke('profilePrompts:list', profileId) as Promise<{ success: boolean; prompts?: ProfilePrompt[]; error?: string }>,
  profilePromptsCreate: (data: { profile_id: string; name: string; prompt_text: string }) =>
    ipcRenderer.invoke('profilePrompts:create', data) as Promise<{ success: boolean; prompt?: ProfilePrompt; error?: string }>,
  profilePromptsUpdate: (promptId: string, data: Partial<{ name: string; prompt_text: string }>) =>
    ipcRenderer.invoke('profilePrompts:update', promptId, data) as Promise<{ success: boolean; prompt?: ProfilePrompt; error?: string }>,
  profilePromptsArchive: (promptId: string) =>
    ipcRenderer.invoke('profilePrompts:archive', promptId) as Promise<{ success: boolean; error?: string }>,

  // Jobs
  jobsGet: (jobId: string) =>
    ipcRenderer.invoke('jobs:get', jobId) as Promise<{ success: boolean; job?: Job | null; error?: string }>,
  jobsCreate: (data: { jd_text: string; source_url?: string }) =>
    ipcRenderer.invoke('jobs:create', data) as Promise<{ success: boolean; job?: Job; error?: string }>,

  // History
  historyList: (query?: { company_name?: string; job_title?: string; keyword?: string; profile_id?: string; limit?: number; offset?: number }) =>
    ipcRenderer.invoke('history:list', query) as Promise<{
      success: boolean;
      results?: Array<{ job: Job; generation: Generation | null; profileName: string | null }>;
      error?: string;
    }>,
  historyGetCounts: () =>
    ipcRenderer.invoke('history:getCounts') as Promise<{ success: boolean; total?: number; today?: number; error?: string }>,

  // Generations
  generationGet: (generationId: string) =>
    ipcRenderer.invoke('generation:get', generationId) as Promise<{ success: boolean; generation?: Generation | null; error?: string }>,
  generationGetLatestForJob: (jobId: string) =>
    ipcRenderer.invoke('generation:getLatestForJob', jobId) as Promise<{ success: boolean; generation?: Generation | null; error?: string }>,
  generationRunCallA: (params: { jdText: string; sourceUrl?: string; profileId: string }) =>
    ipcRenderer.invoke('generation:runCallA', params) as Promise<{
      success: boolean;
      jobId?: string;
      job?: Job | null;
      error?: string;
      rawResponse?: string;
      extraction?: import('@shared/types').CallAOutput;
    }>,
  generationRunFull: (params: { jdText: string; sourceUrl?: string; profileId?: string; profileIds?: string[]; promptId?: string; questions?: string[]; taskId?: number }) =>
    ipcRenderer.invoke('generation:runFull', params) as Promise<{
      success: boolean;
      jobId?: string;
      generationId?: string;
      job?: Job | null;
      extraction?: import('@shared/types').CallAOutput;
      callBOutput?: import('@shared/types').CallBOutput;
      results?: import('@shared/types').GenerationProfileResult[];
      error?: string;
      rawResponse?: string;
      validationErrors?: string[];
      outputDir?: string;
      resumePdfPath?: string | null;
      coverPdfPath?: string | null;
      jdTxtPath?: string | null;
      qaPdfPath?: string | null;
    }>,
  onGenerationProgress: (callback: (data: { taskId?: number; step: string; message: string; percent: number }) => void) => {
    const handler = (_: unknown, data: { taskId?: number; step: string; message: string; percent: number }) => callback(data);
    ipcRenderer.on('generation:progress', handler);
    return () => {
      ipcRenderer.removeListener('generation:progress', handler);
    };
  },

  // Filesystem
  filesOpenFolder: (folderPath: string) =>
    ipcRenderer.invoke('files:openFolder', folderPath) as Promise<{ success: boolean; error?: string }>,
  filesOpenFile: (filePath: string) =>
    ipcRenderer.invoke('files:openFile', filePath) as Promise<{ success: boolean; error?: string }>,
  filesOpenUrl: (url: string) =>
    ipcRenderer.invoke('files:openUrl', url) as Promise<{ success: boolean; error?: string }>,
});

// Type definitions for TypeScript
export type ElectronAPI = {
  getVersion: () => Promise<string>;
  getAppDataPath: () => Promise<string>;
  getChangelog: () => Promise<{ success: boolean; content?: string; error?: string }>;
  configGet: () => Promise<AppConfig>;
  configSet: (config: Partial<AppConfig>) => Promise<{ success: boolean; error?: string }>;
  secretsSetKey: (key: string) => Promise<{ success: boolean; error?: string }>;
  secretsGetKey: () => Promise<{ success: boolean; key?: string | null; error?: string }>;
  secretsHasKey: () => Promise<{ success: boolean; exists: boolean; error?: string }>;
  secretsClearKey: () => Promise<{ success: boolean; error?: string }>;
  dialogSelectFolder: () => Promise<{ success: boolean; path?: string; canceled?: boolean }>;
  dbInit: () => Promise<{ success: boolean; error?: string }>;
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
  jobsGet: (jobId: string) => Promise<{ success: boolean; job?: Job | null; error?: string }>;
  jobsCreate: (data: { jd_text: string; source_url?: string }) => Promise<{ success: boolean; job?: Job; error?: string }>;
  historyList: (query?: { company_name?: string; job_title?: string; keyword?: string; limit?: number; offset?: number }) => Promise<{ success: boolean; results?: Array<{ job: Job; generation: Generation | null }>; error?: string }>;
  generationGet: (generationId: string) => Promise<{ success: boolean; generation?: Generation | null; error?: string }>;
  generationGetLatestForJob: (jobId: string) => Promise<{ success: boolean; generation?: Generation | null; error?: string }>;
  generationRunCallA: (params: { jdText: string; sourceUrl?: string; profileId: string }) => Promise<{
    success: boolean;
    jobId?: string;
    job?: Job | null;
    error?: string;
    rawResponse?: string;
    extraction?: import('@shared/types').CallAOutput;
  }>;
  generationRunFull: (params: { jdText: string; sourceUrl?: string; profileId?: string; profileIds?: string[]; promptId?: string; questions?: string[]; taskId?: number }) => Promise<{
    success: boolean;
    jobId?: string;
    generationId?: string;
    job?: Job | null;
    extraction?: import('@shared/types').CallAOutput;
    callBOutput?: import('@shared/types').CallBOutput;
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
  onGenerationProgress: (callback: (data: { step: string; message: string; percent: number }) => void) => () => void;
  filesOpenFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
  filesOpenFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  filesOpenUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
};

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
