import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { searchManual } from '../../docs/search.js';
import { isDatabaseAvailable } from '../../docs/database.js';
import { hybridSearch } from '../../docs/hybrid-search.js';
import { formatJsonResponse, formatNoResultsResponse } from './shared/response-formatters.js';
import { withErrorHandling } from './shared/error-handlers.js';

export function register(server: McpServer): void {
  server.registerTool(
    'search_manual',
    {
      description:
        'Search the Yamaha MOTIF ES Owner\'s Manual for information about a specific topic. Supports semantic search when the database is available, with keyword fallback.',
      inputSchema: {
        query: z
          .string()
          .describe('Search query - keyword, phrase, or natural language question'),
        chapterId: z
          .string()
          .optional()
          .describe('Optional chapter ID (01-25) to limit search to a specific chapter'),
        limit: z
          .number()
          .optional()
          .describe('Maximum number of results to return (default: 10)'),
        caseSensitive: z
          .boolean()
          .optional()
          .describe('Whether search should be case-sensitive (keyword mode only, default: false)'),
      },
    },
    withErrorHandling(
      async ({ query, chapterId, limit, caseSensitive }: {
        query: string;
        chapterId?: string;
        limit?: number;
        caseSensitive?: boolean;
      }) => {
        if (isDatabaseAvailable()) {
          const results = await hybridSearch(query, { chapterId, limit });

          if (results.length === 0) {
            return formatNoResultsResponse(query, 'results');
          }

          return formatJsonResponse({
            query,
            searchMode: 'hybrid',
            totalResults: results.length,
            results: results.map((r, i) => ({
              rank: i + 1,
              chapterId: r.chapterId,
              chapterTitle: r.chapterTitle,
              score: r.score,
              sources: r.sources,
              content: r.content,
              startLine: r.startLine,
              endLine: r.endLine,
            })),
          });
        }

        // Fallback to keyword search
        const results = searchManual(query, { chapterId, limit, caseSensitive });

        if (results.length === 0) {
          return formatNoResultsResponse(query, 'results');
        }

        return formatJsonResponse({
          query,
          searchMode: 'keyword',
          totalResults: results.length,
          results: results.map((r, i) => ({
            rank: i + 1,
            chapterId: r.chapterId,
            chapterTitle: r.chapterTitle,
            lineNumber: r.lineNumber,
            match: r.lineContent,
            context: r.context,
          })),
        });
      },
      'searching manual'
    )
  );
}
