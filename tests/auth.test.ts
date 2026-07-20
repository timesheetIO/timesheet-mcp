import { describe, expect, test } from '@jest/globals';
import { isApiKeyToken, resolveTokenAuthOptions } from '../src/mcp-app-helpers.js';

// A ts_ personal API key as it arrives via the HTTP Bearer header
const API_KEY = 'ts_abc12345.xyz67890abcdef123456789';
// A JWT-shaped OAuth access token
const JWT_TOKEN =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMSJ9.c2lnbmF0dXJl';

describe('Authentication scheme routing', () => {
  test('ts_ API key received as Bearer token routes to apiKey option', () => {
    // MCP clients can only send Bearer, so ts_ keys arrive as Bearer tokens.
    // They must map to the SDK apiKey option (ApiKey scheme), not oauth2Token
    // (Bearer scheme), which the backend rejects for API keys.
    expect(resolveTokenAuthOptions(API_KEY)).toEqual({ apiKey: API_KEY });
  });

  test('JWT access token routes to oauth2Token option', () => {
    expect(resolveTokenAuthOptions(JWT_TOKEN)).toEqual({ oauth2Token: JWT_TOKEN });
  });

  test('isApiKeyToken distinguishes API keys from JWTs', () => {
    expect(isApiKeyToken(API_KEY)).toBe(true);
    expect(isApiKeyToken(JWT_TOKEN)).toBe(false);
  });
});
