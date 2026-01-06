# Timesheet MCP Server - Cloud Run Deployment
#
# This Dockerfile builds an optimized container for Cloud Run deployment.
# The container runs the HTTP server mode for ChatGPT/web integrations.
#
# For Claude Desktop/CLI (stdio mode), use: npx @timesheet/mcp
# For Cloud Run (HTTP mode), this container runs: node dist/http-server.js

# Build stage - compile TypeScript and bundle widgets
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY build-web.mjs ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY src/ ./src/
COPY web/ ./web/

# Build TypeScript server and React widgets
RUN npm run build

# Production stage - minimal runtime image
FROM node:20-slim AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/web/dist ./web/dist

# Cloud Run sets PORT environment variable (default 8080)
ENV PORT=8080
ENV HOST=0.0.0.0
ENV NODE_ENV=production

# Expose port for documentation (Cloud Run ignores this)
EXPOSE 8080

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Run HTTP server (not stdio mode)
CMD ["node", "dist/http-server.js"]
