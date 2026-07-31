import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { getCurrentUser } = vi.hoisted(() => ({
  getCurrentUser: vi.fn()
}));

vi.mock('../auth/current-user.js', () => ({ getCurrentUser }));

import { createApp } from '../app.js';
import { AppError } from '../errors/app-error.js';

describe('MCP Transport Routes Suite (routes/mcp.ts)', () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
  });

  describe('GET /api/mcp/sse', () => {
    it('rejects unauthenticated request missing Bearer token', async () => {
      getCurrentUser.mockRejectedValue(
        new AppError('UNAUTHORIZED', 'Ban phai cung cap header Authorization: Bearer <token>.', 401)
      );

      const response = await request(createApp())
        .get('/api/mcp/sse')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED'
      });
    });
  });
});
