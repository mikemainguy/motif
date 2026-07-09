import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CHAPTERS } from '../../docs/chapter-index.js';
import { getChapterLines } from '../../docs/manual-loader.js';
import { formatJsonResponse } from './shared/response-formatters.js';
import { withErrorHandling } from './shared/error-handlers.js';

export function register(server: McpServer): void {
  server.registerTool(
    'list_chapters',
    {
      description:
        'List all chapters of the Yamaha MOTIF ES Owner\'s Manual with their titles and line counts',
    },
    withErrorHandling(
      async () => {
        const chapters = CHAPTERS.map((chapter) => {
          const lines = getChapterLines(chapter.id);
          return {
            id: chapter.id,
            title: chapter.title,
            lineCount: lines?.length ?? 0,
          };
        });

        return formatJsonResponse({ totalChapters: chapters.length, chapters });
      },
      'listing chapters'
    )
  );
}
