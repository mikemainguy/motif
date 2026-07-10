import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import express from 'express';
import { MCP_SERVER_CONFIG } from './config.js';
import { setupHandlers } from './handlers/index.js';
import { setupRoutes } from './routes.js';
import { loadAllChapters } from '../docs/manual-loader.js';
import { isDatabaseAvailable } from '../docs/database.js';
import { initEmbedder } from '../docs/embeddings.js';

export class MotifMCPServer {
  private server: McpServer;
  private app: express.Application;
  private httpServer?: ReturnType<express.Application['listen']>;

  constructor() {
    this.app = express();
    this.server = new McpServer(
      {
        name: MCP_SERVER_CONFIG.name,
        version: MCP_SERVER_CONFIG.version,
      },
      {
        capabilities: {
          tools: {},
        },
        instructions: MCP_SERVER_CONFIG.instructions,
      }
    );

    setupHandlers(this.server);
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    process.on('SIGINT', async () => {
      await this.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.shutdown();
      process.exit(0);
    });
  }

  async start(): Promise<void> {
    await loadAllChapters();
    await this.initializeSearch();
    setupRoutes(this.app, this.server);
    this.startHttpServer();
  }

  private async initializeSearch(): Promise<void> {
    try {
      if (isDatabaseAvailable()) {
        await initEmbedder();
        console.log('RAG search initialized (hybrid FTS5 + vector)');
      } else {
        console.log('Database not found at data/motif.db - using fallback text search');
        console.log('Run "npm run ingest" to build the search database');
      }
    } catch (error) {
      console.error('Failed to initialize RAG search, using fallback:', error);
    }
  }

  private startHttpServer(): void {
    const { host, port } = MCP_SERVER_CONFIG.transport;
    this.httpServer = this.app.listen(port, host, () => {
      this.logServerInfo(host, port);
    });
  }

  private logServerInfo(host: string, port: number): void {
    console.log(`${MCP_SERVER_CONFIG.name} v${MCP_SERVER_CONFIG.version} running on HTTP`);
    console.log(`HTTP Server: http://${host}:${port}`);
    console.log(`MCP Endpoint: http://${host}:${port}/mcp`);
    console.log('Ready to serve MOTIF ES documentation');
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down Motif MCP Server...');
    await this.server.close();
    await this.closeHttpServer();
    console.log('Server shutdown complete');
  }

  private async closeHttpServer(): Promise<void> {
    if (!this.httpServer) return;

    await new Promise<void>((resolve) => {
      this.httpServer?.close(() => {
        console.log('HTTP server closed');
        resolve();
      });
    });
  }
}
