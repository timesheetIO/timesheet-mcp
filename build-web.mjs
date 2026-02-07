/**
 * Build script for web components
 * Compiles React components to standalone ESM bundles for MCP Apps SDK
 */

import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import postcss from 'esbuild-postcss';

// Load environment variables
config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const components = [
  { name: 'TimerWidget', file: 'TimerWidget/index.tsx' },
  { name: 'ProjectList', file: 'ProjectList/index.tsx' },
  { name: 'ProjectCard', file: 'ProjectCard/index.tsx' },
  { name: 'TaskList', file: 'TaskList/index.tsx' },
  { name: 'TaskCard', file: 'TaskCard/index.tsx' },
  { name: 'Statistics', file: 'Statistics/index.tsx' },
  { name: 'ExportWidget', file: 'ExportWidget/index.tsx' },
];

const watch = process.argv.includes('--watch');

// Ensure output directory exists
const distDir = path.join(__dirname, 'web', 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Get component base URL from environment
const getComponentBaseUrl = () => {
  return process.env.COMPONENT_BASE_URL || process.env.NGROK_URL || 'http://localhost:3000';
};

// HTML template for components
const createHTML = (componentName, jsFile) => {
  const baseUrl = getComponentBaseUrl();
  const jsUrl = `${baseUrl}/components/${jsFile}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${componentName}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #root {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${jsUrl}"></script>
</body>
</html>`;
};

async function buildComponent(component) {
  const inputFile = path.join(__dirname, 'web', 'src', 'components', component.file);
  const htmlFile = path.join(distDir, `${component.name}.html`);
  const cssEntry = path.join(__dirname, 'web', 'src', 'index.css');

  try {
    // Build CSS separately with PostCSS for Tailwind
    const cssResult = await esbuild.build({
      entryPoints: [cssEntry],
      bundle: true,
      minify: !watch,
      write: false,
      plugins: [postcss()],
      logLevel: 'info',
    });

    const cssCode = cssResult.outputFiles[0].text;

    // Build JavaScript separately
    const jsResult = await esbuild.build({
      entryPoints: [inputFile],
      bundle: true,
      format: 'iife',
      minify: !watch,
      sourcemap: false,
      target: ['es2020'],
      jsx: 'automatic',
      jsxDev: watch,
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.css': 'empty', // Ignore CSS imports since we process CSS separately
      },
      external: [],
      define: {
        'process.env.NODE_ENV': watch ? '"development"' : '"production"',
      },
      write: false,
      logLevel: 'info',
    });

    const jsCode = jsResult.outputFiles[0].text;

    // Create self-contained HTML with inline CSS and JavaScript
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${component.name}</title>
  <style>
${cssCode}
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
${jsCode}
  </script>
</body>
</html>`;

    fs.writeFileSync(htmlFile, html);

    console.log(`✓ Built ${component.name}`);
  } catch (error) {
    console.error(`✗ Failed to build ${component.name}:`, error);
    throw error;
  }
}

async function buildAll() {
  console.log('Building web components...\n');

  for (const component of components) {
    await buildComponent(component);
  }

  console.log('\n✓ All components built successfully!');
  console.log(`Output directory: ${distDir}`);
}

async function watchComponents() {
  console.log('Watching web components for changes...\n');

  const contexts = [];
  const cssEntry = path.join(__dirname, 'web', 'src', 'index.css');

  // Function to get current CSS
  const getCss = async () => {
    const result = await esbuild.build({
      entryPoints: [cssEntry],
      bundle: true,
      write: false,
      plugins: [postcss()],
    });
    return result.outputFiles[0].text;
  };

  for (const component of components) {
    const inputFile = path.join(__dirname, 'web', 'src', 'components', component.file);
    const htmlFile = path.join(distDir, `${component.name}.html`);

    const ctx = await esbuild.context({
      entryPoints: [inputFile],
      bundle: true,
      format: 'iife',
      sourcemap: true,
      target: ['es2020'],
      jsx: 'automatic',
      jsxDev: true,
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.css': 'empty', // Ignore CSS imports since we process CSS separately
      },
      external: [],
      define: {
        'process.env.NODE_ENV': '"development"',
      },
      write: false,
      logLevel: 'info',
      plugins: [{
        name: 'inline-html-writer',
        setup(build) {
          build.onEnd(async (result) => {
            if (result.outputFiles) {
              const jsCode = result.outputFiles[0].text;
              const cssCode = await getCss();
              const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${component.name}</title>
  <style>
${cssCode}
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
${jsCode}
  </script>
</body>
</html>`;
              fs.writeFileSync(htmlFile, html);
            }
          });
        }
      }]
    });

    await ctx.watch();
    contexts.push(ctx);
  }

  console.log('\n✓ Watching for changes...');
  console.log('Press Ctrl+C to stop\n');

  // Keep the process running
  process.on('SIGINT', async () => {
    console.log('\nStopping watchers...');
    for (const ctx of contexts) {
      await ctx.dispose();
    }
    process.exit(0);
  });
}

// Run build
if (watch) {
  watchComponents().catch((error) => {
    console.error('Watch error:', error);
    process.exit(1);
  });
} else {
  buildAll().catch((error) => {
    console.error('Build error:', error);
    process.exit(1);
  });
}
