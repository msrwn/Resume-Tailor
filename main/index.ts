import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { readConfig, writeConfig } from './config/configManager';
import { setApiKey, getApiKey, hasApiKey, clearApiKey } from './config/secretsManager';
import { initDatabase, closeDatabase } from './db/database';
import { seedDefaultProfile } from './db/seed';
import * as profilesDao from './db/profilesDao';
import * as profilePromptsDao from './db/profilePromptsDao';
import * as jobsDao from './db/jobsDao';
import * as generationsDao from './db/generationsDao';
import { runGenerationCallAOnly, runFullGeneration } from './generation/pipeline';
import { disposePdfWindow } from './pdf/pdfRenderer';
import type { AppConfig, GenerationStep } from '../shared/types';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function getIconPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icon.ico');
  }
  return path.join(app.getAppPath(), 'build', 'icon.ico');
}

function createWindow() {
  const iconPath = getIconPath();
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize database
  try {
    initDatabase();
    seedDefaultProfile();
  } catch (error) {
    console.error('Database initialization error:', error);
    // Continue anyway - user will see error in UI if they try to use DB features
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDatabase();
    app.quit();
  }
});

app.on('before-quit', () => {
  disposePdfWindow();
  closeDatabase();
});

// IPC handlers
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:getAppDataPath', () => {
  return app.getPath('userData');
});

ipcMain.handle('app:getChangelog', async () => {
  try {
    const changelogPath = path.join(app.getAppPath(), 'CHANGELOG.md');
    const content = fs.readFileSync(changelogPath, 'utf-8');
    return { success: true, content };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
});

// Config IPC handlers
ipcMain.handle('config:get', () => {
  return readConfig();
});

ipcMain.handle('config:set', (_event, config: Partial<AppConfig>) => {
  try {
    writeConfig(config);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Secrets IPC handlers
ipcMain.handle('secrets:setKey', async (_event, key: string) => {
  try {
    await setApiKey(key);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('secrets:getKey', async () => {
  try {
    const key = await getApiKey();
    return { success: true, key };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('secrets:hasKey', async () => {
  try {
    const exists = await hasApiKey();
    return { success: true, exists };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('secrets:clearKey', async () => {
  try {
    await clearApiKey();
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// File picker for output root path
ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  });

  if (result.canceled) {
    return { success: false, canceled: true };
  }

  return { success: true, path: result.filePaths[0] };
});

// Database IPC handlers
ipcMain.handle('db:init', () => {
  try {
    initDatabase();
    seedDefaultProfile();
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Profiles IPC handlers
ipcMain.handle('profiles:list', () => {
  try {
    const profiles = profilesDao.listProfiles();
    return { success: true, profiles };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('profiles:get', (_event, profileId: string) => {
  try {
    const profile = profilesDao.getProfile(profileId);
    return { success: true, profile };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('profiles:getDefault', () => {
  try {
    const profile = profilesDao.getDefaultProfile();
    return { success: true, profile };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('profiles:create', (_event, data: Parameters<typeof profilesDao.createProfile>[0]) => {
  try {
    const profile = profilesDao.createProfile(data);
    return { success: true, profile };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('profiles:update', (_event, profileId: string, data: Parameters<typeof profilesDao.updateProfile>[1]) => {
  try {
    const profile = profilesDao.updateProfile(profileId, data);
    return { success: true, profile };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('profiles:setDefault', (_event, profileId: string) => {
  try {
    profilesDao.setDefaultProfile(profileId);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('profiles:archive', (_event, profileId: string) => {
  try {
    profilesDao.archiveProfile(profileId);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('profiles:validate', (_event, data: { rules_text: string; template_html: string }) => {
  try {
    const errors: string[] = [];

    if (!data.template_html.trim()) {
      errors.push('Template HTML cannot be empty');
    }

    // Check for required HTML skeleton
    const htmlLower = data.template_html.toLowerCase();
    if (!htmlLower.includes('<html')) {
      errors.push('Template must contain <html> tag');
    }
    if (!htmlLower.includes('<body')) {
      errors.push('Template must contain <body> tag');
    }

    return {
      success: true,
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Profile prompts IPC handlers
ipcMain.handle('profilePrompts:list', (_event, profileId: string) => {
  try {
    const prompts = profilePromptsDao.listPromptsForProfile(profileId);
    return { success: true, prompts };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('profilePrompts:create', (_event, data: Parameters<typeof profilePromptsDao.createPrompt>[0]) => {
  try {
    const prompt = profilePromptsDao.createPrompt(data);
    return { success: true, prompt };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle(
  'profilePrompts:update',
  (_event, promptId: string, data: Parameters<typeof profilePromptsDao.updatePrompt>[1]) => {
    try {
      const prompt = profilePromptsDao.updatePrompt(promptId, data);
      return { success: true, prompt };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
);

ipcMain.handle('profilePrompts:archive', (_event, promptId: string) => {
  try {
    profilePromptsDao.archivePrompt(promptId);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Jobs IPC handlers
ipcMain.handle('jobs:get', (_event, jobId: string) => {
  try {
    const job = jobsDao.getJob(jobId);
    return { success: true, job };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('jobs:create', (_event, data: Parameters<typeof jobsDao.createJob>[0]) => {
  try {
    const job = jobsDao.createJob(data);
    return { success: true, job };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('jobs:updateExtraction', (_event, jobId: string, data: Parameters<typeof jobsDao.updateJobExtraction>[1]) => {
  try {
    const job = jobsDao.updateJobExtraction(jobId, data);
    return { success: true, job };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// History IPC handlers
type HistoryListQuery = Parameters<typeof jobsDao.searchJobs>[0] & { profile_id?: string };
ipcMain.handle('history:list', (_event, query?: HistoryListQuery) => {
  try {
    const { profile_id: profileId, ...searchQuery } = query || {};
    const jobs = jobsDao.searchJobs(searchQuery);
    const byGeneration: Array<{ job: typeof jobs[0]; generation: import('../shared/types').Generation; profileName: string | null; promptName: string | null }> = [];
    for (const job of jobs) {
      const generations = generationsDao.getGenerationsForJob(job.job_id);
      for (const generation of generations) {
        if (profileId != null && generation.profile_id !== profileId) continue;
        const profile = profilesDao.getProfile(generation.profile_id);
        const prompt = generation.prompt_id ? profilePromptsDao.getPrompt(generation.prompt_id) : null;
        byGeneration.push({
          job,
          generation,
          profileName: profile?.name ?? null,
          promptName: prompt?.name ?? null,
        });
      }
    }
    byGeneration.sort((a, b) => new Date(b.generation.created_at).getTime() - new Date(a.generation.created_at).getTime());
    return { success: true, results: byGeneration };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('history:getCounts', () => {
  try {
    const counts = generationsDao.getGenerationCounts();
    return { success: true, total: counts.total, today: counts.today };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Analytics IPC handlers
ipcMain.handle(
  'analytics:getDailyCounts',
  (
    _event,
    params?:
      | {
          range?: '7d' | '30d' | '90d' | 'all';
          fromDate?: string;
          toDate?: string;
        }
      | undefined
  ) => {
    try {
      const now = new Date();

      const toDate =
        params?.toDate ||
        new Date(now.getFullYear(), now.getMonth(), now.getDate())
          .toISOString()
          .slice(0, 10);

      let fromDate: string | undefined = params?.fromDate;

      if (!fromDate && params?.range && params.range !== 'all') {
        const days =
          params.range === '7d' ? 7 : params.range === '30d' ? 30 : 90;
        const start = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - (days - 1)
        );
        fromDate = start.toISOString().slice(0, 10);
      }

      const daily = generationsDao.getDailyGenerationCounts({
        fromDate,
        toDate: params?.range === 'all' && !params?.toDate ? undefined : toDate,
      });

      const { total, today } = generationsDao.getGenerationCounts();

      const sumLastNDays = (days: number) => {
        const cutoff = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - (days - 1)
        )
          .toISOString()
          .slice(0, 10);
        return daily
          .filter((d) => d.date >= cutoff && d.date <= toDate)
          .reduce((acc, d) => acc + d.count, 0);
      };

      const last7Days = sumLastNDays(7);
      const last30Days = sumLastNDays(30);

      return {
        success: true,
        summary: {
          today,
          last7Days,
          last30Days,
          allTime: total,
        },
        data: daily,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
);

// Generations IPC handlers
ipcMain.handle('generation:get', (_event, generationId: string) => {
  try {
    const generation = generationsDao.getGeneration(generationId);
    return { success: true, generation };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('generation:getLatestForJob', (_event, jobId: string) => {
  try {
    const generation = generationsDao.getLatestGenerationForJob(jobId);
    return { success: true, generation };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Filesystem IPC handlers
ipcMain.handle('files:openFolder', async (_event, folderPath: string) => {
  try {
    await shell.openPath(folderPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('files:openFile', async (_event, filePath: string) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('files:openUrl', async (_event, url: string) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Generation pipeline: Call A only (legacy) or full (Call A + Call B + validate)
const withProgress = (params: {
  jdText: string;
  sourceUrl?: string;
  profileId?: string;
  profileIds?: string[];
  questions?: string[];
  taskId?: number;
}) => ({
  ...params,
  onProgress: (step: GenerationStep, message: string, percent: number) => {
    mainWindow?.webContents.send('generation:progress', { taskId: params.taskId, step, message, percent });
  },
});

ipcMain.handle('generation:runCallA', async (_event, params) => {
  try {
    return await runGenerationCallAOnly(withProgress(params));
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('generation:runFull', async (_event, params) => {
  try {
    return await runFullGeneration(withProgress(params));
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});
