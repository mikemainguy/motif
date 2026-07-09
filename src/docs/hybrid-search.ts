import { getDatabase } from './database.js';
import { generateEmbedding } from './embeddings.js';

export interface HybridSearchResult {
  chunkId: number;
  chapterId: string;
  chapterTitle: string;
  chunkIndex: number;
  content: string;
  startLine: number | null;
  endLine: number | null;
  score: number;
  sources: ('fts' | 'vec')[];
}

export interface HybridSearchOptions {
  chapterId?: string | undefined;
  limit?: number | undefined;
}

interface RankedItem {
  chunkId: number;
  chapterId: string;
  chapterTitle: string;
  chunkIndex: number;
  content: string;
  startLine: number | null;
  endLine: number | null;
}

const RRF_K = 60;

export async function hybridSearch(
  query: string,
  options?: HybridSearchOptions
): Promise<HybridSearchResult[]> {
  const limit = options?.limit ?? 10;
  const chapterId = options?.chapterId;
  const candidateCount = limit * 3;

  const db = getDatabase();

  // FTS5 search
  const ftsResults = searchFts(db, query, candidateCount, chapterId);

  // Vector search
  const queryEmbedding = await generateEmbedding(query);
  const vecResults = searchVec(db, queryEmbedding, candidateCount, chapterId);

  // Reciprocal Rank Fusion
  return fuseResults(ftsResults, vecResults, limit);
}

function sanitizeFtsQuery(query: string): string {
  // Split on whitespace, remove FTS5 special chars, quote each token
  const tokens = query
    .split(/\s+/)
    .map((t) => t.replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return '""';
  return tokens.map((t) => `"${t}"`).join(' ');
}

function searchFts(
  db: ReturnType<typeof getDatabase>,
  query: string,
  limit: number,
  chapterId?: string | undefined
): RankedItem[] {
  const sanitized = sanitizeFtsQuery(query);

  const chapterFilter = chapterId
    ? 'AND chunks.chapter_id = ?'
    : '';

  const sql = `
    SELECT chunks.id AS chunk_id, chunks.chapter_id, chunks.chapter_title,
           chunks.chunk_index, chunks.content, chunks.start_line, chunks.end_line
    FROM chunks_fts
    JOIN chunks ON chunks.id = chunks_fts.rowid
    WHERE chunks_fts MATCH ?
    ${chapterFilter}
    ORDER BY rank
    LIMIT ?
  `;

  const params: (string | number)[] = [sanitized];
  if (chapterId) params.push(chapterId);
  params.push(limit);

  try {
    const rows = db.prepare(sql).all(...params) as Array<{
      chunk_id: number;
      chapter_id: string;
      chapter_title: string;
      chunk_index: number;
      content: string;
      start_line: number | null;
      end_line: number | null;
    }>;

    return rows.map((row) => ({
      chunkId: row.chunk_id,
      chapterId: row.chapter_id,
      chapterTitle: row.chapter_title,
      chunkIndex: row.chunk_index,
      content: row.content,
      startLine: row.start_line,
      endLine: row.end_line,
    }));
  } catch {
    // FTS query might fail on unusual input
    return [];
  }
}

function searchVec(
  db: ReturnType<typeof getDatabase>,
  queryEmbedding: number[],
  limit: number,
  chapterId?: string | undefined
): RankedItem[] {
  const embeddingBuffer = Buffer.from(new Float32Array(queryEmbedding).buffer);

  if (chapterId) {
    // sqlite-vec doesn't support JOIN filters in WHERE clause
    // Fetch more results and filter in application code
    const unfilteredSql = `
      SELECT chunks.id AS chunk_id, chunks.chapter_id, chunks.chapter_title,
             chunks.chunk_index, chunks.content, chunks.start_line, chunks.end_line,
             chunks_vec.distance AS vec_distance
      FROM chunks_vec
      JOIN chunks ON chunks.id = chunks_vec.rowid
      WHERE embedding MATCH ?
        AND k = ?
      ORDER BY distance
    `;

    const rows = db.prepare(unfilteredSql).all(embeddingBuffer, limit * 5) as Array<{
      chunk_id: number;
      chapter_id: string;
      chapter_title: string;
      chunk_index: number;
      content: string;
      start_line: number | null;
      end_line: number | null;
      vec_distance: number;
    }>;

    return rows
      .filter((row) => row.chapter_id === chapterId)
      .slice(0, limit)
      .map((row) => ({
        chunkId: row.chunk_id,
        chapterId: row.chapter_id,
        chapterTitle: row.chapter_title,
        chunkIndex: row.chunk_index,
        content: row.content,
        startLine: row.start_line,
        endLine: row.end_line,
      }));
  }

  const sql = `
    SELECT chunks.id AS chunk_id, chunks.chapter_id, chunks.chapter_title,
           chunks.chunk_index, chunks.content, chunks.start_line, chunks.end_line,
           chunks_vec.distance AS vec_distance
    FROM chunks_vec
    JOIN chunks ON chunks.id = chunks_vec.rowid
    WHERE embedding MATCH ?
      AND k = ?
    ORDER BY distance
  `;

  const rows = db.prepare(sql).all(embeddingBuffer, limit) as Array<{
    chunk_id: number;
    chapter_id: string;
    chapter_title: string;
    chunk_index: number;
    content: string;
    start_line: number | null;
    end_line: number | null;
    vec_distance: number;
  }>;

  return rows.map((row) => ({
    chunkId: row.chunk_id,
    chapterId: row.chapter_id,
    chapterTitle: row.chapter_title,
    chunkIndex: row.chunk_index,
    content: row.content,
    startLine: row.start_line,
    endLine: row.end_line,
  }));
}

function fuseResults(
  ftsResults: RankedItem[],
  vecResults: RankedItem[],
  limit: number
): HybridSearchResult[] {
  const scoreMap = new Map<number, { ftsRank?: number; vecRank?: number; item: RankedItem }>();

  for (let i = 0; i < ftsResults.length; i++) {
    const item = ftsResults[i]!;
    scoreMap.set(item.chunkId, { ftsRank: i + 1, item });
  }

  for (let i = 0; i < vecResults.length; i++) {
    const item = vecResults[i]!;
    const existing = scoreMap.get(item.chunkId);
    if (existing) {
      existing.vecRank = i + 1;
    } else {
      scoreMap.set(item.chunkId, { vecRank: i + 1, item });
    }
  }

  const fused: HybridSearchResult[] = [];

  for (const [, entry] of scoreMap) {
    const ftsScore = entry.ftsRank != null ? 1 / (RRF_K + entry.ftsRank) : 0;
    const vecScore = entry.vecRank != null ? 1 / (RRF_K + entry.vecRank) : 0;
    const sources: ('fts' | 'vec')[] = [];
    if (entry.ftsRank != null) sources.push('fts');
    if (entry.vecRank != null) sources.push('vec');

    fused.push({
      chunkId: entry.item.chunkId,
      chapterId: entry.item.chapterId,
      chapterTitle: entry.item.chapterTitle,
      chunkIndex: entry.item.chunkIndex,
      content: entry.item.content,
      startLine: entry.item.startLine,
      endLine: entry.item.endLine,
      score: ftsScore + vecScore,
      sources,
    });
  }

  fused.sort((a, b) => b.score - a.score);
  return fused.slice(0, limit);
}
