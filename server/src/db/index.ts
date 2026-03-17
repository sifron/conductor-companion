import Database from 'better-sqlite3';

let db: Database.Database | null = null;
let writeDb: Database.Database | null = null;
let dbPath: string | null = null;

export function openDatabase(path: string): Database.Database {
  dbPath = path;
  db = new Database(path, { readonly: true });
  db.pragma('query_only = ON');
  db.pragma('journal_mode'); // Read current journal mode (should be WAL)
  return db;
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function getWriteDb(): Database.Database {
  if (!writeDb) {
    if (!dbPath) throw new Error('Database not initialized');
    writeDb = new Database(dbPath);
    writeDb.pragma('journal_mode = WAL');
  }
  return writeDb;
}
