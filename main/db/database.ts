import * as path from 'path';
import { app } from 'electron';
import { runMigrations } from './migrations';

type DatabaseInstance = import('better-sqlite3').Database;
let db: DatabaseInstance | null = null;

function loadBetterSqlite3(): typeof import('better-sqlite3') {
  try {
    return require('better-sqlite3');
  } catch {
    throw new Error(
      'Database not available: better-sqlite3 did not install or compile.\n' +
        'On Node 24 Windows, install ClangCL from VS Installer (see NODE24_CLANGCL.md) or use Node 20 LTS.'
    );
  }
}

/**
 * Get database instance, creating it if necessary.
 */
export function getDatabase(): DatabaseInstance {
  if (db) {
    return db;
  }

  try {
    const Database = loadBetterSqlite3();
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    const dbFileName = isDev ? 'app-dev.db' : 'app.db';
    const dbPath = path.join(app.getPath('userData'), dbFileName);
    db = new Database(dbPath);

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Run migrations
    runMigrations(db);

    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw new Error(
      'Database initialization failed. Please ensure better-sqlite3 is compiled.\n' +
      'Run: npm rebuild better-sqlite3\n' +
      'Or install Visual Studio Build Tools with C++ workload.'
    );
  }
}

/**
 * Close database connection.
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Initialize database (called on app startup).
 */
export function initDatabase(): void {
  getDatabase();
}
