/**
 * Component Server for OpenAI Apps SDK
 * Serves built React components for ChatGPT integration
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ComponentServerOptions {
  port?: number;
  host?: string;
}

export class ComponentServer {
  private app: express.Application;
  private server: any;
  private port: number;
  private host: string;

  constructor(options: ComponentServerOptions = {}) {
    this.port = options.port || 4444;
    this.host = options.host || '0.0.0.0';
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Enable CORS for ChatGPT to access components
    this.app.use(cors({
      origin: [
        'https://chat.openai.com',
        'https://chatgpt.com',
        'https://web-sandbox.oaiusercontent.com',
        'http://localhost:*',
      ],
      credentials: true,
    }));

    // Serve static files from web/dist
    const distPath = path.join(__dirname, '..', 'web', 'dist');
    this.app.use('/components', express.static(distPath));

    // Add headers for component security
    this.app.use((req, res, next) => {
      // Allow components to be embedded in iframes
      res.setHeader('X-Frame-Options', 'ALLOW-FROM https://chat.openai.com');
      res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://chat.openai.com https://chatgpt.com;");
      next();
    });
  }

  private setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // List available components
    this.app.get('/components', (req, res) => {
      res.json({
        components: [
          {
            name: 'TimerWidget',
            url: `/components/TimerWidget.html`,
            description: 'Display timer status and controls',
          },
          {
            name: 'ProjectList',
            url: `/components/ProjectList.html`,
            description: 'List projects with timer controls',
          },
          {
            name: 'TaskList',
            url: `/components/TaskList.html`,
            description: 'Display time entries',
          },
          {
            name: 'Statistics',
            url: `/components/Statistics.html`,
            description: 'Show time tracking statistics',
          },
        ],
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Component not found' });
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, this.host, () => {
          console.error(`Component server running at https://${this.host}:${this.port}`);
          console.error(`Components available at https://${this.host}:${this.port}/components/`);
          resolve();
        });

        this.server.on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            console.error(`Port ${this.port} is already in use`);
          } else {
            console.error('Component server error:', error);
          }
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.error('Component server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public getBaseUrl(): string {
    return `https://${this.host}:${this.port}`;
  }
}

// Start component server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new ComponentServer({
    port: parseInt(process.env.COMPONENT_PORT || '4444'),
    host: process.env.COMPONENT_HOST || '0.0.0.0',
  });

  server.start().catch((error) => {
    console.error('Failed to start component server:', error);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.error('\nShutting down component server...');
    await server.stop();
    process.exit(0);
  });
}
