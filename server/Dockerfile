# ============================================
# DOCKERFILE - Backend API Server
# Bonario Stock Management - Express Server
# ============================================

FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY server/package.json server/pnpm-lock.yaml server/pnpm-workspace.yaml ./

# Install dependencies
RUN corepack enable && corepack prepare pnpm@11.5.1 --activate
RUN pnpm install --prod --frozen-lockfile

# Copy server files
COPY server/ .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4001/api/health || exit 1

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Expose port
EXPOSE 4001

# Start server
CMD ["node", "index.js"]
