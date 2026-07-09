import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { findChapter } from '../../docs/chapter-index.js';
import { getChapterLines } from '../../docs/manual-loader.js';
import { formatJsonResponse, formatNotFoundResponse } from './shared/response-formatters.js';
import { withErrorHandling } from './shared/error-handlers.js';

export function register(server: McpServer): void {
  server.registerTool(
    'read_chapter',
    {
      description:
        'Read the content of a specific chapter from the Yamaha MOTIF ES Owner\'s Manual. Supports pagination via startLine and maxLines.',
      inputSchema: {
        chapterId: z
          .string()
          .describe('Chapter ID (01-25) or partial chapter title (e.g. "troubleshooting", "voice mode")'),
        startLine: z
          .number()
          .optional()
          .describe('Start reading from this line number (1-based, default: 1)'),
        maxLines: z
          .number()
          .optional()
          .describe('Maximum number of lines to return (default: 200)'),
      },
    },
    withErrorHandling(
      async ({ chapterId, startLine, maxLines }: { chapterId: string; startLine?: number; maxLines?: number }) => {
        const chapter = findChapter(chapterId);
        if (!chapter) {
          return formatNotFoundResponse(chapterId, 'Chapter');
        }

        const lines = getChapterLines(chapter.id);
        if (!lines) {
          return formatNotFoundResponse(chapterId, 'Chapter content');
        }

        const start = Math.max(0, (startLine ?? 1) - 1);
        const max = maxLines ?? 200;
        const selectedLines = lines.slice(start, start + max);
        const truncated = start + max < lines.length;

        return formatJsonResponse({
          chapterId: chapter.id,
          title: chapter.title,
          totalLines: lines.length,
          startLine: start + 1,
          linesReturned: selectedLines.length,
          truncated,
          content: selectedLines.join('\n'),
        });
      },
      'reading chapter'
    )
  );
}
