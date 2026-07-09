import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as listChaptersHandler from './list-chapters.handler.js';
import * as readChapterHandler from './read-chapter.handler.js';
import * as searchManualHandler from './search-manual.handler.js';

export function setupHandlers(server: McpServer): void {
  listChaptersHandler.register(server);
  readChapterHandler.register(server);
  searchManualHandler.register(server);
}
