/**
 * Local HTTP server for Apply Automation (Chrome extension).
 * GET /health, /profiles, /autofill?profileId=, /match?url=&profileId=
 * Bind 127.0.0.1 only; single port per env (dev 38421, prod 38422).
 */

import * as http from 'http';
import * as path from 'path';
import { app } from 'electron';
import { normalizeJobUrl } from '../shared/jobUrl';
import * as profilesDao from './db/profilesDao';
import * as generationsDao from './db/generationsDao';
import * as applicantDao from './db/applicantDao';

let serverRef: http.Server | null = null;
let serverRunning = false;

const DEV_PORT = 38421;
const PROD_PORT = 38422;

function getPort(): number {
  return process.env.NODE_ENV === 'development' || !app.isPackaged ? DEV_PORT : PROD_PORT;
}

function sendJson(res: http.ServerResponse, statusCode: number, body: unknown): void {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.writeHead(statusCode);
  res.end(JSON.stringify(body));
}

function sendError(res: http.ServerResponse, statusCode: number, code: string, message: string): void {
  sendJson(res, statusCode, { error: code, message });
}

function parseQuery(url: string): URLSearchParams {
  try {
    const u = new URL(url, 'http://127.0.0.1');
    return u.searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function handleHealth(res: http.ServerResponse): void {
  sendJson(res, 200, { ok: serverRunning });
}

function handleProfiles(res: http.ServerResponse): void {
  try {
    const profiles = profilesDao.listProfiles();
    const list = profiles.map((p) => ({
      profileId: p.profile_id,
      name: p.name,
      applicantId: p.applicant_id ?? null,
    }));
    sendJson(res, 200, list);
  } catch (e) {
    console.error('[AutofillServer] /profiles error:', e);
    sendError(res, 500, 'SERVER_ERROR', 'Failed to list profiles');
  }
}

function handleAutofill(res: http.ServerResponse, profileId: string): void {
  if (!profileId) {
    sendError(res, 400, 'MISSING_PROFILE_ID', 'profileId is required');
    return;
  }
  try {
    const profile = profilesDao.getProfile(profileId);
    if (!profile) {
      sendError(res, 404, 'NOT_FOUND', 'Profile not found');
      return;
    }
    const applicantId = profile.applicant_id ?? null;
    if (!applicantId) {
      sendJson(res, 200, { applicant: null, answers: {} });
      return;
    }
    const applicantRow = applicantDao.getApplicantProfile(applicantId);
    if (!applicantRow) {
      sendJson(res, 200, { applicant: null, answers: {} });
      return;
    }
    const answers = applicantDao.getAutofillAnswers(applicantId);
    const applicant = {
      firstName: applicantRow.first_name ?? '',
      lastName: applicantRow.last_name ?? '',
      email: applicantRow.email ?? '',
      phone: applicantRow.phone ?? '',
      address: {
        address1: applicantRow.address1 ?? '',
        address2: applicantRow.address2 ?? '',
        city: applicantRow.city ?? '',
        state: applicantRow.state ?? '',
        zip: applicantRow.zip ?? '',
        country: applicantRow.country ?? '',
      },
    };
    sendJson(res, 200, { applicant, answers });
  } catch (e) {
    console.error('[AutofillServer] /autofill error:', e);
    sendError(res, 500, 'SERVER_ERROR', 'Failed to get autofill data');
  }
}

function handleMatch(res: http.ServerResponse, urlParam: string, profileIdParam: string): void {
  const profileId = profileIdParam?.trim() || '';
  if (!profileId) {
    sendError(res, 400, 'MISSING_PROFILE_ID', 'profileId is required');
    return;
  }
  const rawUrl = (urlParam ?? '').trim();
  if (!rawUrl) {
    sendJson(res, 200, { match: 'none' });
    return;
  }
  const { normalizedUrl } = normalizeJobUrl(rawUrl);
  if (!normalizedUrl) {
    sendJson(res, 200, { match: 'none' });
    return;
  }
  try {
    const gen = generationsDao.getMatchGeneration(normalizedUrl, profileId);
    if (!gen) {
      sendJson(res, 200, { match: 'none' });
      return;
    }
    const resumePdfPath = gen.resume_pdf_path ? path.resolve(gen.resume_pdf_path) : null;
    const coverPdfPath = gen.cover_pdf_path ? path.resolve(gen.cover_pdf_path) : null;
    const jobJsonPath = path.join(gen.output_dir, 'job.json');
    sendJson(res, 200, {
      match: 'exact',
      generationId: gen.generation_id,
      files: {
        resumePdfPath,
        coverPdfPath,
      },
      jobJsonPath: path.resolve(jobJsonPath),
    });
  } catch (e) {
    console.error('[AutofillServer] /match error:', e);
    sendError(res, 500, 'SERVER_ERROR', 'Failed to match');
  }
}

function requestListener(req: http.IncomingMessage, res: http.ServerResponse): void {
  if (req.method !== 'GET') {
    sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
    return;
  }
  const url = req.url ?? '';
  const query = parseQuery(url);
  const pathname = url.split('?')[0]?.replace(/^\/+/, '') || '';

  if (pathname === 'health') {
    handleHealth(res);
    return;
  }
  if (pathname === 'profiles') {
    handleProfiles(res);
    return;
  }
  if (pathname === 'autofill') {
    handleAutofill(res, query.get('profileId') ?? '');
    return;
  }
  if (pathname === 'match') {
    handleMatch(res, query.get('url') ?? '', query.get('profileId') ?? '');
    return;
  }

  sendError(res, 404, 'NOT_FOUND', 'Not found');
}

/**
 * Start the autofill server. Call from app.whenReady().
 * If the port is in use, logs an error and does not set serverRef (health will return ok: false if we add a flag).
 */
export function startAutofillServer(): void {
  if (serverRef) return;
  const server = http.createServer(requestListener);
  const port = getPort();

  server.once('error', (err: NodeJS.ErrnoException) => {
    console.error('[AutofillServer] Failed to bind:', err.message);
    if (err.code === 'EADDRINUSE') {
      console.error(`[AutofillServer] Port ${port} is in use. Autofill/match will not be available.`);
    }
    serverRef = null;
    serverRunning = false;
  });

  server.listen(port, '127.0.0.1', () => {
    serverRef = server;
    serverRunning = true;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AutofillServer] Listening on http://127.0.0.1:${port}`);
    }
  });
}

/**
 * Stop the autofill server. Call from app before-quit.
 */
export function stopAutofillServer(): void {
  if (serverRef) {
    serverRef.close();
    serverRef = null;
    serverRunning = false;
  }
}
