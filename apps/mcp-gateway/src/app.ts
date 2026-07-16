import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/error-handler.js';
import { toolsRouter } from './routes/tools.js';
import { mcpRouter } from './routes/mcp.js';

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
  app.use(cors());
  app.use((req, res, next) => {
    if (req.path === '/api/mcp/message') {
      return next();
    }
    express.json({ limit: '1mb' })(req, res, next);
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'mcp-gateway' });
  });

  app.use('/api', apiRateLimiter);
  app.use('/api', mcpRouter);
  app.use('/api', toolsRouter);
  app.use(errorHandler);

  return app;
}
