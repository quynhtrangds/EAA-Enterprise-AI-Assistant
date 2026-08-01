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

  describe('POST /api/mcp/message', () => {
    it('trả 400 khi thiếu query param sessionId', async () => {
      const response = await request(createApp())
        .post('/api/mcp/message')
        .send({ method: 'tools/list' })
        .expect(400);

      expect(response.body).toMatchObject({ success: false, errorCode: 'INVALID_TOOL_INPUT' });
    });

    it('trả 404 khi sessionId không khớp session SSE nào đang kết nối', async () => {
      const response = await request(createApp())
        .post('/api/mcp/message?sessionId=session-khong-ton-tai')
        .send({ method: 'tools/list' })
        .expect(404);

      expect(response.body).toMatchObject({ success: false, errorCode: 'TOOL_NOT_FOUND' });
    });
  });
});
