export interface ChunkMetadata {
  chapterId: string;
  chapterTitle: string;
  chunkIndex: number;
  content: string;
  startLine: number;
  endLine: number;
}

const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_OVERLAP = 160;

export function chunkText(
  text: string,
  chapterId: string,
  chapterTitle: string,
  options?: { chunkSize?: number | undefined; overlap?: number | undefined }
): ChunkMetadata[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.overlap ?? DEFAULT_OVERLAP;

  const normalized = text.replace(/\t/g, '  ').replace(/\r\n/g, '\n');

  // Split into paragraphs first
  const paragraphs = normalized.split(/\n\n+/);

  // Build chunks by merging paragraphs up to chunkSize
  const rawChunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length === 0) continue;

    if (current.length === 0) {
      current = trimmed;
    } else if (current.length + trimmed.length + 2 <= chunkSize) {
      current = current + '\n\n' + trimmed;
    } else {
      // Emit current chunk
      rawChunks.push(current);
      // Start new chunk with overlap from end of previous
      const overlapText = extractOverlap(current, overlap);
      current = overlapText.length > 0 ? overlapText + '\n\n' + trimmed : trimmed;
    }
  }

  if (current.trim().length > 0) {
    rawChunks.push(current);
  }

  // Split any oversized chunks by line
  const finalChunks: string[] = [];
  for (const chunk of rawChunks) {
    if (chunk.length <= chunkSize * 1.5) {
      finalChunks.push(chunk);
    } else {
      finalChunks.push(...splitByLine(chunk, chunkSize, overlap));
    }
  }

  // Build metadata with line numbers
  const chunks: ChunkMetadata[] = [];
  let searchOffset = 0;

  for (const chunk of finalChunks) {
    const trimmed = chunk.trim();
    if (trimmed.length === 0) continue;

    const chunkStart = normalized.indexOf(trimmed.slice(0, Math.min(50, trimmed.length)), searchOffset);
    const startLine = chunkStart >= 0
      ? countNewlines(normalized, 0, chunkStart) + 1
      : 1;
    const endLine = startLine + countNewlines(trimmed, 0, trimmed.length);

    if (chunkStart >= 0) {
      searchOffset = Math.max(searchOffset, chunkStart + 1);
    }

    chunks.push({
      chapterId,
      chapterTitle,
      chunkIndex: chunks.length,
      content: trimmed,
      startLine,
      endLine,
    });
  }

  return chunks;
}

function splitByLine(
  text: string,
  chunkSize: number,
  overlap: number
): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let current = '';

  for (const line of lines) {
    if (current.length === 0) {
      current = line;
    } else if (current.length + line.length + 1 <= chunkSize) {
      current = current + '\n' + line;
    } else {
      chunks.push(current);
      const overlapText = extractOverlap(current, overlap);
      current = overlapText.length > 0 ? overlapText + '\n' + line : line;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current);
  }

  return chunks;
}

function extractOverlap(text: string, overlap: number): string {
  if (text.length <= overlap) return text;
  const tail = text.slice(-overlap);
  // Try to start at a newline boundary
  const newlineIdx = tail.indexOf('\n');
  if (newlineIdx >= 0 && newlineIdx < tail.length - 1) {
    return tail.slice(newlineIdx + 1);
  }
  // Try space boundary
  const spaceIdx = tail.indexOf(' ');
  if (spaceIdx >= 0 && spaceIdx < tail.length - 1) {
    return tail.slice(spaceIdx + 1);
  }
  return tail;
}

function countNewlines(
  text: string,
  start: number,
  end: number
): number {
  let count = 0;
  for (let i = start; i < end && i < text.length; i++) {
    if (text[i] === '\n') count++;
  }
  return count;
}
