import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'os';

/**
 * Render HTML to PDF buffer using a hidden BrowserWindow.
 * Reuses a single hidden window for sequential calls.
 * Uses a temp file to load HTML so content is not affected by data-URL encoding/size limits.
 */
let hiddenWindow: BrowserWindow | null = null;

function getHiddenWindow(): BrowserWindow {
  if (hiddenWindow && !hiddenWindow.isDestroyed()) {
    return hiddenWindow;
  }
  hiddenWindow = new BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  return hiddenWindow;
}

/**
 * Generate PDF from HTML string. Returns buffer.
 * Writes HTML to a temp file and loads it via file:// to avoid data-URL encoding/size issues.
 */
export function renderHtmlToPdf(html: string): Promise<Buffer> {
  const win = getHiddenWindow();
  const tmpFile = path.join(tmpdir(), `resume-tailor-pdf-${Date.now()}.html`);
  fs.writeFileSync(tmpFile, html, 'utf-8');
  const fileUrl = pathToFileURL(tmpFile).href;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      try {
        fs.unlinkSync(tmpFile);
      } catch {
        /* ignore */
      }
      reject(new Error('PDF render timeout'));
    }, 30000);

    const cleanup = () => {
      try {
        fs.unlinkSync(tmpFile);
      } catch {
        /* ignore */
      }
    };

    win.webContents.once('did-finish-load', () => {
      win.webContents
        .printToPDF({
          printBackground: true,
          margins: { marginType: 'default' },
          pageSize: 'Letter',
        })
        .then((data) => {
          clearTimeout(timeout);
          cleanup();
          resolve(data);
        })
        .catch((err) => {
          clearTimeout(timeout);
          cleanup();
          reject(err);
        });
    });

    win.loadURL(fileUrl).catch((err) => {
      clearTimeout(timeout);
      cleanup();
      reject(err);
    });
  });
}

/**
 * Call when app is quitting to destroy the hidden window.
 */
export function disposePdfWindow(): void {
  if (hiddenWindow && !hiddenWindow.isDestroyed()) {
    hiddenWindow.destroy();
    hiddenWindow = null;
  }
}
