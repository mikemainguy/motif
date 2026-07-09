import { CHAPTERS } from './chapter-index.js';
import { getChapterLines } from './manual-loader.js';

export interface SearchResult {
  chapterId: string;
  chapterTitle: string;
  lineNumber: number;
  lineContent: string;
  context: string;
}

export interface SearchOptions {
  chapterId?: string | undefined;
  limit?: number | undefined;
  caseSensitive?: boolean | undefined;
}

const CONTEXT_LINES = 2;

export function searchManual(
  query: string,
  options: SearchOptions = {}
): SearchResult[] {
  const { chapterId, limit = 10, caseSensitive = false } = options;
  const normalizedQuery = caseSensitive ? query : query.toLowerCase();
  const results: SearchResult[] = [];

  const chaptersToSearch = chapterId
    ? CHAPTERS.filter((c) => c.id === chapterId)
    : CHAPTERS;

  for (const chapter of chaptersToSearch) {
    if (results.length >= limit) break;

    const lines = getChapterLines(chapter.id);
    if (!lines) continue;

    for (let i = 0; i < lines.length; i++) {
      if (results.length >= limit) break;

      const line = lines[i]!;
      const compareLine = caseSensitive ? line : line.toLowerCase();

      if (compareLine.includes(normalizedQuery)) {
        const start = Math.max(0, i - CONTEXT_LINES);
        const end = Math.min(lines.length - 1, i + CONTEXT_LINES);
        const contextLines = lines.slice(start, end + 1);

        results.push({
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          lineNumber: i + 1,
          lineContent: line.trim(),
          context: contextLines.join('\n'),
        });
      }
    }
  }

  return results;
}
