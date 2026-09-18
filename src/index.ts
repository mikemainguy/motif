import { loadLocalEnv } from './load-env.js';
import { MotifMCPServer } from './mcp/server.js';

loadLocalEnv();

async function main() {
  const server = new MotifMCPServer();
  await server.start();
}

main().catch((error) => {
  console.error('Failed to start Motif MCP Server:', error);
  process.exit(1);
});
