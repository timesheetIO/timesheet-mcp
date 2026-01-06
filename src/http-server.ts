#!/usr/bin/env node
/**
 * HTTP Server for OpenAI Apps SDK / ChatGPT Integration
 *
 * Uses StreamableHTTPServerTransport in STATELESS mode to avoid session timeout issues.
 * Each request is independent - no session persistence required since the Timesheet API
 * maintains all actual state (running timers, tasks, projects, etc.)
 *
 * OAuth 2.1 Support:
 * - Serves /.well-known/oauth-protected-resource for ChatGPT discovery
 * - Accepts Bearer tokens in Authorization header
 * - Returns proper WWW-Authenticate headers on 401
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { TimesheetMCPServer } from './index.js';
import {
  getProtectedResourceMetadata,
  getAuthorizationServerMetadata,
  getWWWAuthenticateHeader,
  extractBearerToken,
  getApiBaseUrl,
  getMcpServerUrl,
} from './openai-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';

const app = express();

// Enable CORS for ChatGPT and Cloud Run
app.use(cors({
  origin: [
    // ChatGPT domains
    'https://chat.openai.com',
    'https://chatgpt.com',
    'https://web-sandbox.oaiusercontent.com',
    // Cloud Run domains
    /https:\/\/.*\.run\.app/,
    'https://mcp.timesheet.io',
    // Development domains
    /https:\/\/.*\.ngrok-free\.dev/,
    /https:\/\/.*\.ngrok\.io/,
    'http://localhost:3000',
    'http://localhost:5173',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'mcp-session-id'],
  exposedHeaders: ['mcp-session-id'],
}));

// Parse JSON for all requests
app.use(express.json());

// Serve static component files
const distPath = path.join(__dirname, '..', 'web', 'dist');
app.use('/components', express.static(distPath, {
  setHeaders: (res) => {
    res.setHeader('X-Frame-Options', 'ALLOW-FROM https://chat.openai.com');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://chat.openai.com https://chatgpt.com https://web-sandbox.oaiusercontent.com;");
  },
}));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    server: 'timesheet-mcp-http',
    mode: 'stateless',
    oauth: {
      protected_resource_metadata: '/.well-known/oauth-protected-resource',
      authorization_server: getApiBaseUrl(),
    },
  });
});

// ============================================================================
// OAuth 2.1 Discovery Endpoints (RFC 9728)
// ============================================================================

/**
 * Protected Resource Metadata (RFC 9728)
 * ChatGPT fetches this to discover how to authenticate with this MCP server
 */
app.get('/.well-known/oauth-protected-resource', (req, res) => {
  console.error('[OAuth] Protected Resource Metadata request');

  const metadata = getProtectedResourceMetadata();

  // Set appropriate cache headers (metadata doesn't change often)
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Type', 'application/json');

  console.error('[OAuth] Returning metadata:', JSON.stringify(metadata, null, 2));
  res.json(metadata);
});

/**
 * Authorization Server Metadata (RFC 8414)
 * ChatGPT fetches this to discover OAuth endpoints and PKCE support
 */
app.get('/.well-known/oauth-authorization-server', (req, res) => {
  console.error('[OAuth] Authorization Server Metadata request');

  const metadata = getAuthorizationServerMetadata();

  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Type', 'application/json');

  console.error('[OAuth] Returning auth server metadata:', JSON.stringify(metadata, null, 2));
  res.json(metadata);
});

/**
 * OpenID Configuration (alias for authorization server metadata)
 * Some clients look for this endpoint instead
 */
app.get('/.well-known/openid-configuration', (req, res) => {
  console.error('[OAuth] OpenID Configuration request');

  const metadata = getAuthorizationServerMetadata();

  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Type', 'application/json');

  res.json(metadata);
});

// List available components
app.get('/components', (req, res) => {
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

// ============================================================================
// MCP Endpoint with OAuth 2.1 Token Support
// ============================================================================

// MCP endpoint path - can be configured via environment variable
// Default: '/' for clean URLs (mcp.timesheet.io)
// Set MCP_ENDPOINT_PATH='/mcp' for backwards compatibility if needed
const MCP_ENDPOINT_PATH = process.env.MCP_ENDPOINT_PATH || '/';

/**
 * MCP endpoint using StreamableHTTPServerTransport in STATELESS mode
 *
 * Key: sessionIdGenerator is set to undefined to disable session management.
 * This means each request is completely independent - no session persistence required.
 *
 * OAuth 2.1 Support:
 * - Extracts Bearer token from Authorization header
 * - Passes token to MCP server for API authentication
 * - Returns 401 with WWW-Authenticate header if auth fails
 *
 * This solves the "Session not found" errors that occur when:
 * - ChatGPT doesn't maintain session headers between calls
 * - SSE connections timeout
 * - Network interruptions occur
 */
app.post(MCP_ENDPOINT_PATH, async (req, res) => {
  console.error(`[MCP] POST request from: ${req.headers.origin || 'unknown'}`);

  // Extract Bearer token from Authorization header (if present)
  const authHeader = req.headers.authorization;
  const bearerToken = extractBearerToken(authHeader as string | undefined);

  if (bearerToken) {
    console.error('[MCP] Bearer token found in Authorization header');
  } else if (authHeader) {
    console.error(`[MCP] Authorization header present but not Bearer: ${authHeader.substring(0, 20)}...`);
  } else {
    console.error('[MCP] No Authorization header - will use environment API key if available');
  }

  try {
    // Create a new MCP server instance for each request (stateless)
    // Pass the OAuth token if present
    const mcpServer = new TimesheetMCPServer({ oauthToken: bearerToken || undefined });
    const server = mcpServer.getServer();

    // Create transport in STATELESS mode (sessionIdGenerator: undefined)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // STATELESS MODE - no sessions!
    });

    // Connect server to transport
    await server.connect(transport);

    // Handle the request
    await transport.handleRequest(req, res, req.body);

    // Clean up after request
    await transport.close();
    await server.close();

  } catch (error) {
    console.error('[MCP] Error handling request:', error);

    if (!res.headersSent) {
      // Check if this is an authentication error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isAuthError = errorMessage.toLowerCase().includes('auth') ||
                          errorMessage.toLowerCase().includes('unauthorized') ||
                          errorMessage.toLowerCase().includes('401') ||
                          errorMessage.toLowerCase().includes('token');

      if (isAuthError) {
        // Return 401 with WWW-Authenticate header for OAuth discovery
        res.setHeader('WWW-Authenticate', getWWWAuthenticateHeader('invalid_token', errorMessage));
        res.status(401).json({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Authentication required',
            data: {
              error: 'invalid_token',
              error_description: errorMessage,
              authorization_server: getApiBaseUrl(),
              protected_resource_metadata: `${getMcpServerUrl()}/.well-known/oauth-protected-resource`,
            },
          },
          id: null,
        });
      } else {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
            data: error instanceof Error ? error.message : String(error),
          },
          id: null,
        });
      }
    }
  }
});

// Landing page path
const landingPagePath = path.join(__dirname, '..', 'web', 'landing.html');

// Handle GET requests - serve landing page for browsers, error for MCP clients
app.get(MCP_ENDPOINT_PATH, async (req, res) => {
  const acceptHeader = req.headers.accept || '';
  const userAgent = req.headers['user-agent'] || '';

  // Check if this is a browser request (wants HTML)
  const wantsBrowser = acceptHeader.includes('text/html') ||
                       (userAgent.includes('Mozilla') && !acceptHeader.includes('application/json'));

  if (wantsBrowser) {
    // Serve landing page for browser requests
    console.error(`[Landing] Serving landing page to: ${userAgent.substring(0, 50)}`);
    res.sendFile(landingPagePath, (err) => {
      if (err) {
        console.error('[Landing] Error serving landing page:', err);
        res.status(500).send('Error loading landing page');
      }
    });
  } else {
    // Return JSON error for MCP/API clients
    console.error(`[MCP] GET request (SSE) from: ${req.headers.origin || 'unknown'}`);
    res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: 'This server operates in stateless mode. Use POST requests only.',
      },
      id: null,
    });
  }
});

// Handle DELETE requests for session termination
app.delete(MCP_ENDPOINT_PATH, async (req, res) => {
  console.error(`[MCP] DELETE request from: ${req.headers.origin || 'unknown'}`);

  // In stateless mode, there's nothing to delete
  res.status(200).json({
    jsonrpc: '2.0',
    result: { message: 'Stateless mode - no session to terminate' },
    id: null,
  });
});

// 404 handler
app.use((req, res) => {
  console.error('404 Not Found:', req.method, req.path);
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    availableEndpoints: [
      '/ (GET: landing page, POST: MCP protocol)',
      '/health',
      '/components',
      '/.well-known/oauth-protected-resource',
      '/.well-known/oauth-authorization-server',
      '/.well-known/openid-configuration',
    ],
  });
});

// Start server
const server = app.listen(PORT, HOST, () => {
  const mcpUrl = getMcpServerUrl();
  const apiUrl = getApiBaseUrl();

  console.error(`\n🚀 Timesheet MCP HTTP Server (Stateless Mode + OAuth 2.1)`);
  console.error(`   Local:       http://${HOST}:${PORT}`);
  console.error(`   Landing:     http://${HOST}:${PORT}/ (GET)`);
  console.error(`   MCP:         http://${HOST}:${PORT}/ (POST)`);
  console.error(`   Components:  http://${HOST}:${PORT}/components/`);
  console.error(`\n🔐 OAuth 2.1 Endpoints:`);
  console.error(`   Protected Resource: http://${HOST}:${PORT}/.well-known/oauth-protected-resource`);
  console.error(`   Authorization Server: ${apiUrl}`);
  console.error(`   Dynamic Registration: ${apiUrl}/oauth2/register`);
  console.error(`\n📝 Production URL: ${mcpUrl}`);
  console.error(`\n✅ Features:`);
  console.error(`   - Landing page at root for browsers`);
  console.error(`   - MCP protocol at root for POST requests`);
  console.error(`   - Stateless mode: No session timeouts`);
  console.error(`   - OAuth 2.1: Bearer token authentication`);
  console.error('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.error('\n👋 Shutting down server...');
  server.close(() => {
    console.error('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.error('\n👋 Shutting down server...');
  server.close(() => {
    console.error('✅ Server closed');
    process.exit(0);
  });
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
