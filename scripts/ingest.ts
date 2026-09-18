import { loadLocalEnv } from '../src/load-env.js';
import { readFile } from 'node:fs/promises';
import { unlinkSync, existsSync } from 'node:fs';
import path from 'node:path';
import { CHAPTERS } from '../src/docs/chapter-index.js';
import { chunkText } from '../src/docs/chunker.js';
import { createDatabase, closeDatabase } from '../src/docs/database.js';
import { generateEmbeddings, initEmbedder } from '../src/docs/embeddings.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'motif.db');

loadLocalEnv();

async function main() {
  console.log('=== Motif ES Manual Ingestion ===\n');

  // Remove existing DB for fresh build
  if (existsSync(DB_PATH)) {
    console.log('Removing existing database...');
    unlinkSync(DB_PATH);
    // Also remove WAL/SHM files if they exist
    if (existsSync(DB_PATH + '-wal')) unlinkSync(DB_PATH + '-wal');
    if (existsSync(DB_PATH + '-shm')) unlinkSync(DB_PATH + '-shm');
  }

  // Initialize database
  console.log('Creating database schema...');
  const db = createDatabase();

  // Initialize embedding model
  await initEmbedder();

  // Prepare statements
  const insertChunk = db.prepare(`
    INSERT INTO chunks (chapter_id, chapter_title, chunk_index, content, start_line, end_line)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertVec = db.prepare(`
    INSERT INTO chunks_vec (rowid, embedding)
    VALUES (?, ?)
  `);
  const insertFts = db.prepare(`
    INSERT INTO chunks_fts (rowid, content)
    VALUES (?, ?)
  `);

  let totalChunks = 0;

  for (const chapter of CHAPTERS) {
    const filePath = path.join(DATA_DIR, chapter.filename);
    const content = await readFile(filePath, 'utf-8');

    // Chunk the chapter
    const chunks = chunkText(content, chapter.id, chapter.title);
    console.log(`Chapter ${chapter.id} (${chapter.title}): ${chunks.length} chunks`);

    // Generate embeddings for all chunks in this chapter
    const texts = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(texts);

    // Insert in a transaction
    const insertAll = db.transaction(() => {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!;
        const embedding = embeddings[i]!;

        const info = insertChunk.run(
          chunk.chapterId,
          chunk.chapterTitle,
          chunk.chunkIndex,
          chunk.content,
          chunk.startLine,
          chunk.endLine
        );

        const rowid = info.lastInsertRowid;
        const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);
        insertVec.run(BigInt(rowid), embeddingBuffer);
        insertFts.run(BigInt(rowid), chunk.content);
      }
    });

    insertAll();
    totalChunks += chunks.length;
  }

  // Print stats
  const dbSize = existsSync(DB_PATH)
    ? (await import('node:fs')).statSync(DB_PATH).size
    : 0;

  console.log(`\n=== Ingestion Complete ===`);
  console.log(`Total chunks: ${totalChunks}`);
  console.log(`Database size: ${(dbSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Database path: ${DB_PATH}`);

  closeDatabase();
}

main().catch((error) => {
  console.error('Ingestion failed:', error);
  process.exit(1);
});
