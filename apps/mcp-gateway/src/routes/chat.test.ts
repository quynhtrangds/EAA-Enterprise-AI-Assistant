import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { query, getCurrentUser } = vi.hoisted(() => ({
  query: vi.fn(),
  getCurrentUser: vi.fn()
}));

vi.mock('../db/pool.js', () => ({ query }));
vi.mock('../auth/current-user.js', () => ({ getCurrentUser }));

import { createApp } from '../app.js';
import { AppError } from '../errors/app-error.js';

describe('Chat Routes Integration Suite (routes/chat.ts)', () => {
  const mockUser = {
    id: '10000000-0000-0000-0000-000000000002',
    username: 'manager',
    displayName: 'Quản lý',
    roles: ['manager'],
    tenantId: '00000000-0000-0000-0000-000000000000'
  };

  beforeEach(() => {
    query.mockReset();
    getCurrentUser.mockReset();
  });

  describe('GET /api/chat/sessions', () => {
    it('rejects unauthenticated request missing Bearer token', async () => {
      getCurrentUser.mockRejectedValue(
        new AppError('UNAUTHORIZED', 'Ban phai cung cap header Authorization: Bearer <token>.', 401)
      );

      const response = await request(createApp())
        .get('/api/chat/sessions')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED'
      });
    });

    it('returns user sessions ordered by update date', async () => {
      getCurrentUser.mockResolvedValue(mockUser);
      query.mockResolvedValueOnce({
        rows: [
          { id: 'sess-001', session_code: 's-001', title: 'Hỏi về doanh thu', updated_at: '2026-07-31T10:00:00Z' }
        ]
      });

      const response = await request(createApp())
        .get('/api/chat/sessions')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.sessions).toHaveLength(1);
      expect(response.body.sessions[0].session_code).toBe('s-001');
    });
  });

  describe('GET /api/chat/sessions/:sessionCode', () => {
    it('returns empty messages array when session is not found', async () => {
      getCurrentUser.mockResolvedValue(mockUser);
      query.mockResolvedValueOnce({ rows: [] });

      const response = await request(createApp())
        .get('/api/chat/sessions/non-existent-code')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toEqual({
        sessionId: 'non-existent-code',
        messages: []
      });
    });

    it('returns session title and formatted messages when session exists', async () => {
      getCurrentUser.mockResolvedValue(mockUser);

      // Session query
      query.mockResolvedValueOnce({
        rows: [{ id: 'sess-uuid-100', session_code: 'sess-100', title: 'Tra cứu đơn hàng' }]
      });
      // Messages query
      query.mockResolvedValueOnce({
        rows: [
          { id: 'msg-1', role: 'user', content: 'Tìm đơn DH001', tool_call_ids: [], created_at: '2026-07-31T10:00:00Z' },
          { id: 'msg-2', role: 'assistant', content: 'Đơn DH001 hoàn tất', tool_call_ids: [], created_at: '2026-07-31T10:01:00Z' }
        ]
      });
      // Audit logs query
      query.mockResolvedValueOnce({ rows: [] });

      const response = await request(createApp())
        .get('/api/chat/sessions/sess-100')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.sessionId).toBe('sess-100');
      expect(response.body.title).toBe('Tra cứu đơn hàng');
      expect(response.body.messages).toHaveLength(2);
      expect(response.body.messages[0].sender).toBe('user');
      expect(response.body.messages[1].sender).toBe('ai');
    });
  });

  describe('POST /api/chat/messages', () => {
    it('saves chat messages and updates session code', async () => {
      getCurrentUser.mockResolvedValue(mockUser);

      // Session insert/update query
      query.mockResolvedValueOnce({ rows: [{ id: 'new-sess-uuid' }] });
      // Message insert query
      query.mockResolvedValueOnce({ rows: [] });

      const response = await request(createApp())
        .post('/api/chat/messages')
        .set('Authorization', 'Bearer valid-token')
        .send({
          sessionCode: 'sess-code-200',
          title: 'Phiên mới',
          messages: [{ role: 'user', content: 'Xin chào' }]
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        sessionId: 'new-sess-uuid'
      });
    });
  });
});
