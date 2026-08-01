# ============================================================
# Multi-Stage Dockerfile for AI Orchestrator
# Enterprise AI Assistant Platform
# ============================================================

# --- Stage 1: Build stage ---
FROM node:20-alpine AS builder
WORKDIR /workspace

# Copy app source
COPY apps/ai-orchestrator/ ./apps/ai-orchestrator/

WORKDIR /workspace/apps/ai-orchestrator
RUN npm ci && npm run build

# --- Stage 2: Production runner ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8082

COPY --from=builder /workspace/apps/ai-orchestrator/package*.json ./
COPY --from=builder /workspace/apps/ai-orchestrator/dist ./dist

RUN npm install --omit=dev

EXPOSE 8082

CMD ["node", "dist/server.js"]
