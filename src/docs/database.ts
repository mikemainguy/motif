import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { getEmbeddingDimensions, getEmbeddingModel } from './embeddings.js';

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
      embedding float[${getEmbeddingDimensions()}]
    );
  `);

  // Record which model produced the vectors so a stale database is caught
  // rather than silently returning nonsense.
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const setMeta = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
  setMeta.run('embedding_model', getEmbeddingModel());
  setMeta.run('embedding_dimensions', String(getEmbeddingDimensions()));

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
      content,
      tokenize='porter unicode61 remove_diacritics 1'
    );
  `);

  return db;
}

/**
 * Throws if the database was built with a different embedding model than the
 * one currently configured. Vectors from different models are not comparable,
 * so the only fix is a re-ingest.
 */
export function assertEmbeddingCompatibility(): void {
  const database = getDatabase();
  const model = getEmbeddingModel();

  let stored: { key: string; value: string }[];
  try {
    stored = database.prepare('SELECT key, value FROM meta').all() as {
      key: string;
      value: string;
    }[];
  } catch {
    throw new Error(
      'Database predates embedding-model tracking. Re-run "npm run ingest".'
    );
  }

  const storedModel = stored.find((row) => row.key === 'embedding_model')?.value;
  if (storedModel !== model) {
    throw new Error(
      `Database was built with embedding model "${storedModel ?? 'unknown'}" but ` +
        `"${model}" is configured. Re-run "npm run ingest".`
    );
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
