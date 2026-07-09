import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CHAPTERS, type ChapterInfo } from './chapter-index.js';

const chapterCache = new Map<string, string>();

function getDataDir(): string {
  return path.join(process.cwd(), 'data');
}

export async function loadAllChapters(): Promise<void> {
  const dataDir = getDataDir();
  const loadPromises = CHAPTERS.map(async (chapter) => {
    const filePath = path.join(dataDir, chapter.filename);
    const content = await readFile(filePath, 'utf-8');
    chapterCache.set(chapter.id, content);
  });
  await Promise.all(loadPromises);
  console.log(`Loaded ${chapterCache.size} chapters into memory`);
}

export function getChapterContent(chapterId: string): string | undefined {
  return chapterCache.get(chapterId);
}

export function getChapterLines(chapterId: string): string[] | undefined {
  const content = chapterCache.get(chapterId);
  if (content === undefined) return undefined;
  return content.split('\n');
}

export function getAllLoadedChapters(): Map<string, string> {
  return chapterCache;
}

export function getChapterInfo(chapterId: string): ChapterInfo | undefined {
  return CHAPTERS.find((c) => c.id === chapterId);
}
