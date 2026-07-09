import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'node:path';
import { existsSync } from 'node:fs';

let db: Database.Database | null = null;

function getDbPath(): string {
  return path.join(process.cwd(), 'data', 'motif.db');
}

export function isDatabaseAvailable(): boolean {
  return existsSync(getDbPath());
}

export function getDatabase(): Database.Database {
  if (db) return db;

  const dbPath = getDbPath();
  db = new Database(dbPath);
  sqliteVec.load(db);
  db.pragma('journal_mode = WAL');
  return db;
}

export function createDatabase(): Database.Database {
  const dbPath = getDbPath();
  db = new Database(dbPath);
  sqliteVec.load(db);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      chapter_title TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      start_line INTEGER,
      end_line INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_chapter ON chunks(chapter_id);
  `);

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
      embedding float[384]
    );
  `);

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
      content,
      tokenize='porter unicode61 remove_diacritics 1'
    );
  `);

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
