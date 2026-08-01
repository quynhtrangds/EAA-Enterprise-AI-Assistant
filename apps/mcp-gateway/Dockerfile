# ============================================================
# Multi-Stage Dockerfile for MCP Gateway
# Enterprise AI Assistant Platform
# ============================================================

# --- Stage 1: Build stage ---
FROM node:20-alpine AS builder
WORKDIR /workspace

# Copy root packages and gateway source
COPY packages/ ./packages/
COPY apps/mcp-gateway/ ./apps/mcp-gateway/

# Build all MCP connector packages
RUN for d in packages/mcp-server-*; do \
      if [ -f "$d/package.json" ]; then \
        echo "Building $d..." && (cd "$d" && npm ci && npm run build); \
      fi \
    done

# Build mcp-gateway app
WORKDIR /workspace/apps/mcp-gateway
RUN npm ci && npm run build

# --- Stage 2: Production runner ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8081

# Copy built connector packages & gateway artifact
COPY --from=builder /workspace/packages /packages
COPY --from=builder /workspace/apps/mcp-gateway/package.json ./package.json
COPY --from=builder /workspace/apps/mcp-gateway/connector.json ./connector.json
COPY --from=builder /workspace/apps/mcp-gateway/dist ./dist

# Install production dependencies only
RUN npm install --omit=dev
RUN for d in /packages/mcp-server-*; do \
      if [ -f "$d/package.json" ]; then \
        (cd "$d" && npm install --omit=dev); \
      fi \
    done

EXPOSE 8081

CMD ["node", "dist/server.js"]
