import { describe, expect, test } from '@jest/globals';

describe('Basic Tests', () => {
  test('project structure is correct', () => {
    expect(true).toBe(true);
  });

  test('package.json has correct name', () => {
    const packageJson = require('../package.json');
    expect(packageJson.name).toBe('@timesheet/mcp');
  });

  test('package.json has bin entry', () => {
    const packageJson = require('../package.json');
    expect(packageJson.bin).toBeDefined();
    expect(packageJson.bin['timesheet-mcp']).toBe('dist/index.js');
  });

  test('required dependencies are present', () => {
    const packageJson = require('../package.json');
    expect(packageJson.dependencies['@modelcontextprotocol/server']).toBeDefined();
    expect(packageJson.dependencies['@modelcontextprotocol/node']).toBeDefined();
    // The v1 SDK is gone, and ext-apps is only needed to build the widgets
    expect(packageJson.dependencies['@modelcontextprotocol/sdk']).toBeUndefined();
    expect(packageJson.dependencies['@modelcontextprotocol/ext-apps']).toBeUndefined();
    expect(packageJson.dependencies['@timesheet/sdk']).toBeDefined();
    expect(packageJson.dependencies['dotenv']).toBeDefined();
  });

  test('build script is configured', () => {
    const packageJson = require('../package.json');
    expect(packageJson.scripts.build).toBeDefined();
    expect(packageJson.scripts.build).toBe('npm run build:server && npm run build:web');
  });
});