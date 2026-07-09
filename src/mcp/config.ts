export const MCP_SERVER_CONFIG = {
  name: 'motif-es-manual',
  version: '1.0.0',
  description: 'Yamaha MOTIF ES Owner\'s Manual MCP Server',

  capabilities: {
    tools: {
      description: 'Provides tools for searching and reading the Yamaha MOTIF ES synthesizer manual',
      available: ['list_chapters', 'read_chapter', 'search_manual'],
    },
  },

  instructions:
    'Motif ES Manual MCP Server provides access to the Yamaha MOTIF ES6/ES7/ES8 synthesizer Owner\'s Manual. ' +
    'Available tools:\n' +
    '- list_chapters: List all chapters with titles and line counts\n' +
    '- read_chapter: Read a specific chapter by ID or title (supports pagination)\n' +
    '- search_manual: Search the manual by keyword or natural language query (hybrid semantic + keyword search)\n' +
    'Use list_chapters first to discover available content, then read_chapter or search_manual for details.',

  transport: {
    defaultPort: 3001,
    endpoint: '/mcp',
  },
} as const;
