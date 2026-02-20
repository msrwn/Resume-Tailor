/**
 * Clear history data (jobs + generations) from the app database.
 * Keeps profiles intact. Close the app before running.
 *
 * Usage:
 *   node scripts/clear-history.js        Clear production DB (app.db)
 *   node scripts/clear-history.js dev    Clear development DB (app-dev.db)
 */

const path = require('path');
const fs = require('fs');

const isDev = process.argv[2] === 'dev';
const dbFileName = isDev ? 'app-dev.db' : 'app.db';

function getDbPath() {
  const candidates = [];
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const appData = process.env.APPDATA || '';
    candidates.push(
      path.join(localAppData, 'Programs', 'Resume Tailor', dbFileName),
      path.join(appData, 'Resume Tailor', dbFileName),
      path.join(appData, 'resume-tailor', dbFileName)
    );
  } else if (process.platform === 'darwin') {
    const base = process.env.HOME + '/Library/Application Support';
    candidates.push(
      path.join(base, 'Resume Tailor', dbFileName),
      path.join(base, 'resume-tailor', dbFileName)
    );
  } else {
    const base = process.env.HOME + '/.config';
    candidates.push(
      path.join(base, 'Resume Tailor', dbFileName),
      path.join(base, 'resume-tailor', dbFileName)
    );
  }
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

const dbPath = getDbPath();
if (!fs.existsSync(dbPath)) {
  console.error('Database not found at:', dbPath);
  console.error('Make sure the app has been run at least once. Close the app before running this script.');
  process.exit(1);
}

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('better-sqlite3 not found. Run from project root: npm install && node scripts/clear-history.js');
  process.exit(1);
}

const db = new Database(dbPath);
try {
  const delGen = db.prepare('DELETE FROM generations');
  const delJobs = db.prepare('DELETE FROM jobs');
  db.transaction(() => {
    delGen.run();
    delJobs.run();
  })();
  console.log(`History cleared in ${dbPath} (jobs + generations). Profiles kept.`);
  db.close();
} catch (e) {
  db.close();
  console.error('Error:', e.message);
  process.exit(1);
}
