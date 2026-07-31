import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/error-handler.js';
import { toolsRouter } from './routes/tools.js';
import { mcpRouter } from './routes/mcp.js';
import { adminRouter } from './routes/admin.js';
import { chatRouter } from './routes/chat.js';
import { env } from './config/env.js';

const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    errorCode: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.'
  }
});

export function createApp(): express.Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean) }));
  app.use((req, res, next) => {
    express.json({ limit: '1mb' })(req, res, next);
  });

  app.get('/', (_req, res) => {
    res.json({ service: 'Enterprise AI MCP Gateway', status: 'running', healthCheck: '/health', version: '1.0.0' });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'mcp-gateway' });
  });

  app.use('/api', apiRateLimiter);
  app.use('/api', mcpRouter);
  app.use('/api', toolsRouter);
  app.use('/api', chatRouter);
  app.use('/api/admin', adminRouter);
  app.use(errorHandler);

  return app;
}
