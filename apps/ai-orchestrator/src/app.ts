import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler } from './middleware/error-handler.js';
import { chatRouter } from './routes/chat.js';
import { env } from './config/env.js';

export function createApp(): express.Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean) }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/', (_req, res) => {
    res.json({ service: 'Enterprise AI Orchestrator', status: 'running', healthCheck: '/health', version: '1.0.0' });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'ai-orchestrator' });
  });

  app.use('/api', chatRouter);
  app.use(errorHandler);

  return app;
}
