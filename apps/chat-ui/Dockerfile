# ============================================================
# Multi-Stage Dockerfile for Chat UI (Frontend)
# Enterprise AI Assistant Platform
# ============================================================

# --- Stage 1: Build static assets ---
FROM node:20-alpine AS builder
WORKDIR /workspace

COPY apps/chat-ui/ ./apps/chat-ui/

WORKDIR /workspace/apps/chat-ui
RUN npm ci && npm run build

# --- Stage 2: Serve via Nginx ---
FROM nginx:alpine AS runner

COPY --from=builder /workspace/apps/chat-ui/dist /usr/share/nginx/html
COPY apps/chat-ui/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
