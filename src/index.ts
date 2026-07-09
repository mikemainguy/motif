import { MotifMCPServer } from './mcp/server.js';

async function main() {
  const server = new MotifMCPServer();
  await server.start();
}

main().catch((error) => {
  console.error('Failed to start Motif MCP Server:', error);
  process.exit(1);
});
