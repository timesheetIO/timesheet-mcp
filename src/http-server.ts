#!/usr/bin/env node
/**
 * HTTP Server for MCP Apps SDK / ChatGPT Integration
 *
 * Serves protocol 2026-07-28 and 2025-era clients on one endpoint through the SDK's
 * createMcpHandler. Every request gets a fresh server instance (stateless): the Timesheet API
 * keeps all real state (running timers, tasks, projects, etc.).
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
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { TimesheetMCPServer } from './index.js';
import {
  getProtectedResourceMetadata,
  getWWWAuthenticateHeader,
  getAuthChallenge,
  getJsonRpcRequestId,
  createDocumentProxy,
  extractBearerToken,
  toAuthInfo,
  getApiBaseUrl,
  getMcpServerUrl,
  isJwtToken,
  isLocalOrigin,
  checkTokenWithApi,
  createTokenValidator,
  type ProxiedDocument,
} from './mcp-app-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000');
// Loopback unless told otherwise: a request without credentials runs on TIMESHEET_API_TOKEN, so
// listening on every interface would share that key with the network. The image sets 0.0.0.0.
const HOST = process.env.HOST || '127.0.0.1';

const app = express();

// Enable CORS for ChatGPT and Cloud Run
app.use(cors({
  origin: [
    // ChatGPT domains
    'https://chat.openai.com',
    'https://chatgpt.com',
    'https://web-sandbox.oaiusercontent.com',
    // Cloud Run domains. Anchored: unanchored, https://x.run.app.example.com matched as well.
    /^https:\/\/[a-z0-9.-]+\.run\.app$/,
    'https://mcp.timesheet.io',
    // Development domains
    /^https:\/\/[a-z0-9-]+\.ngrok-free\.dev$/,
    /^https:\/\/[a-z0-9-]+\.ngrok\.io$/,
    'http://localhost:3000',
    'http://localhost:5173',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  // Mcp-Method / Mcp-Name ride on every 2026-07-28 request; without them a browser client's
  // preflight fails and it silently falls back to the 2025 protocol
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'mcp-session-id', 'MCP-Protocol-Version', 'Mcp-Method', 'Mcp-Name'],
  // Browser clients can only read the 401 challenge if it is exposed
  exposedHeaders: ['mcp-session-id', 'WWW-Authenticate'],
}));

// Parse JSON for all requests
app.use(express.json());

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
  console.error('[OAuth] MCP_SERVER_URL env:', process.env.MCP_SERVER_URL);
  console.error('[OAuth] getMcpServerUrl():', getMcpServerUrl());

  const metadata = getProtectedResourceMetadata();

  // Set appropriate cache headers (metadata doesn't change often)
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Type', 'application/json');

  console.error('[OAuth] Returning metadata:', JSON.stringify(metadata, null, 2));
  res.json(metadata);
});

/**
 * Authorization Server Metadata (RFC 8414) and OpenID Configuration
 *
 * The authorization server is the API, and current clients read these documents there, as the
 * protected resource metadata says. Clients of the 2025-03-26 MCP spec look for them on this
 * origin instead, so they are served here as live copies of the API's documents.
 */
const authorizationServerMetadata = createDocumentProxy(
  `${getApiBaseUrl()}/.well-known/oauth-authorization-server`
);
const openIdConfiguration = createDocumentProxy(`${getApiBaseUrl()}/.well-known/openid-configuration`);

async function sendProxiedDocument(res: express.Response, load: () => Promise<ProxiedDocument>) {
  const { status, body } = await load();
  if (status === 200) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
  res.status(status).json(body);
}

app.get('/.well-known/oauth-authorization-server', async (req, res) => {
  console.error('[OAuth] Authorization Server Metadata request');
  await sendProxiedDocument(res, authorizationServerMetadata);
});

app.get('/.well-known/openid-configuration', async (req, res) => {
  console.error('[OAuth] OpenID Configuration request');
  await sendProxiedDocument(res, openIdConfiguration);
});

// ============================================================================
// MCP Endpoint with OAuth 2.1 Token Support
// ============================================================================

// MCP endpoint path - can be configured via environment variable
// Default: '/' for clean URLs (mcp.timesheet.io)
// Set MCP_ENDPOINT_PATH='/mcp' for backwards compatibility if needed
const MCP_ENDPOINT_PATH = process.env.MCP_ENDPOINT_PATH || '/';

/**
 * One handler for both protocol eras. 2026-07-28 requests (per-request _meta envelope) are served
 * by the SDK directly; 2025-era requests (initialize, claim-less calls) get the stateless fallback,
 * a fresh instance over a streamable HTTP transport, which is what this server always did.
 * The factory receives the bearer token that passed the 401 gate as authInfo.
 */
const mcpHandler = createMcpHandler(
  ({ authInfo }) => new TimesheetMCPServer({ oauthToken: authInfo?.token, hosted: true }).getServer(),
  {
    legacy: 'stateless',
    // A subscriptions/listen stream holds a Cloud Run request slot for its lifetime, and this server
    // never publishes list changes, so keep the number an instance serves low.
    maxSubscriptions: 16,
    onerror: (error) => console.error('[MCP] handler:', error),
  }
);
const handleMcp = toNodeHandler(mcpHandler, {
  onerror: (error) => console.error('[MCP] adapter:', error),
});

/** Whether the API still accepts an OAuth token; see createTokenValidator. */
const isTokenAccepted = createTokenValidator(checkTokenWithApi(getApiBaseUrl()));

/**
 * The largest JSON-RPC batch accepted. Batches exist only in protocol 2025-03-26, and each entry
 * can fan out into many API calls.
 */
const MAX_BATCH_SIZE = 20;

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

  // Refuse before doing any work, for every era alike: MCP clients only start OAuth on a 401, and
  // a 2026-07-28 client reads a 401 on its server/discover probe as "sign in", never as a reason
  // to fall back to the 2025 protocol.
  const challenge = getAuthChallenge(bearerToken, !!process.env.TIMESHEET_API_TOKEN);
  if (challenge) {
    console.error(`[MCP] 401 ${challenge.error ?? 'no credentials'}`);
    res.setHeader('WWW-Authenticate', getWWWAuthenticateHeader(challenge.error, challenge.errorDescription));
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Authentication required',
      },
      id: getJsonRpcRequestId(req.body),
    });
    return;
  }

  // Without credentials the request runs on TIMESHEET_API_TOKEN (local use). A web page from another
  // origin, or one that reached this port through DNS rebinding, must not get to use that key.
  if (!bearerToken && !isLocalOrigin(req.headers.origin)) {
    console.error(`[MCP] 403 origin ${req.headers.origin} without credentials`);
    res.status(403).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Forbidden: requests from this origin need credentials' },
      id: getJsonRpcRequestId(req.body),
    });
    return;
  }

  // An OAuth token the API no longer accepts (revoked, signed out) gets the same 401 as an expired
  // one, so the client refreshes or signs in again instead of failing every tool call
  if (bearerToken && isJwtToken(bearerToken) && !(await isTokenAccepted(bearerToken))) {
    console.error('[MCP] 401 invalid_token (rejected by the API)');
    res.setHeader('WWW-Authenticate', getWWWAuthenticateHeader('invalid_token', 'The access token is no longer valid'));
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Authentication required',
      },
      id: getJsonRpcRequestId(req.body),
    });
    return;
  }

  if (Array.isArray(req.body) && req.body.length > MAX_BATCH_SIZE) {
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: `Batches are limited to ${MAX_BATCH_SIZE} requests` },
      id: null,
    });
    return;
  }

  // API keys and OAuth tokens pass through unchanged; the API verifies them on every call
  const auth = bearerToken ? toAuthInfo(bearerToken) : undefined;
  await handleMcp(Object.assign(req, { auth }), res, req.body);
});

// Landing page path
const landingPagePath = path.join(__dirname, '..', 'web', 'landing.html');

// Social preview image referenced by the landing page's og:image tag
const ogImagePath = path.join(__dirname, '..', 'web', 'og.jpg');
app.get('/og.jpg', (req, res) => {
  res.sendFile(ogImagePath, { maxAge: '1d' });
});

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
  console.error(`\n🔐 OAuth 2.1 Endpoints:`);
  console.error(`   Protected Resource: http://${HOST}:${PORT}/.well-known/oauth-protected-resource`);
  console.error(`   Authorization Server: ${apiUrl}`);
  console.error(`   Dynamic Registration: ${apiUrl}/oauth2/register`);
  console.error(`\n📝 Environment:`);
  console.error(`   MCP_SERVER_URL: ${process.env.MCP_SERVER_URL || '(not set)'}`);
  console.error(`   Resolved MCP URL: ${mcpUrl}`);
  console.error(`\n✅ Features:`);
  console.error(`   - Landing page at root for browsers`);
  console.error(`   - MCP protocol at root for POST requests`);
  console.error(`   - Stateless mode: No session timeouts`);
  console.error(`   - OAuth 2.1: Bearer token authentication`);
  console.error('');
});

// Graceful shutdown: end in-flight 2026-07-28 exchanges and listen streams, then stop listening
async function shutdown() {
  console.error('\n👋 Shutting down server...');
  await mcpHandler.close().catch((error) => console.error('[MCP] close:', error));
  server.close(() => {
    console.error('✅ Server closed');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Logged, not fatal: the SDK aborts a handler when its client disconnects, and a late rejection
// from such an abandoned request must not take down an instance serving everyone else.
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
});
