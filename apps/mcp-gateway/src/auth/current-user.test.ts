import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request } from 'express';

const { getUserByToken } = vi.hoisted(() => ({
  getUserByToken: vi.fn()
}));

vi.mock('./auth-sessions.js', () => ({ getUserByToken }));

const { getCurrentUser, createToolContext } = await import('./current-user.js');

function mockRequest(headers: Record<string, string | undefined> = {}): Request {
  return {
    header: (name: string) => headers[name.toLowerCase()]
  } as unknown as Request;
}

describe('auth/current-user.ts', () => {
  beforeEach(() => {
    getUserByToken.mockReset();
  });

  describe('getCurrentUser', () => {
    it('ném UNAUTHORIZED 401 khi không có header Authorization', async () => {
      const req = mockRequest({});
      await expect(getCurrentUser(req)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        statusCode: 401
      });
      expect(getUserByToken).not.toHaveBeenCalled();
    });

    it('ném UNAUTHORIZED 401 khi header không đúng định dạng "Bearer <token>"', async () => {
      const req = mockRequest({ authorization: 'Basic dXNlcjpwYXNz' });
      await expect(getCurrentUser(req)).rejects.toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 });
    });

    it('ném UNAUTHORIZED 401 khi "Bearer" không kèm token (chỉ có khoảng trắng)', async () => {
      const req = mockRequest({ authorization: 'Bearer    ' });
      await expect(getCurrentUser(req)).rejects.toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 });
    });

    it('nhận diện "bearer" không phân biệt hoa/thường', async () => {
      getUserByToken.mockResolvedValue({
        id: 'u1', username: 'staff', displayName: 'Staff', roles: ['staff'], tenantId: 't1'
      });
      const req = mockRequest({ authorization: 'bearer abc123' });
      const user = await getCurrentUser(req);
      expect(user.username).toBe('staff');
      expect(getUserByToken).toHaveBeenCalledWith('abc123');
    });

    it('ném UNAUTHENTICATED 401 khi token hợp lệ về mặt định dạng nhưng không tồn tại/hết hạn trong DB', async () => {
      getUserByToken.mockResolvedValue(null);
      const req = mockRequest({ authorization: 'Bearer token-khong-ton-tai' });
      await expect(getCurrentUser(req)).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
        statusCode: 401
      });
    });

    it('trả về đúng CurrentUser khi token hợp lệ', async () => {
      const sessionUser = {
        id: 'u-123', username: 'admin', displayName: 'Quản trị viên', roles: ['admin'], tenantId: 't-1'
      };
      getUserByToken.mockResolvedValue(sessionUser);
      const req = mockRequest({ authorization: 'Bearer valid-token-xyz' });
      const user = await getCurrentUser(req);
      expect(user).toEqual(sessionUser);
    });

    it('trim khoảng trắng thừa quanh token trước khi tra DB', async () => {
      getUserByToken.mockResolvedValue({ id: 'u1', username: 'x', displayName: 'X', roles: [], tenantId: 't1' });
      const req = mockRequest({ authorization: '  Bearer   abc123  ' });
      await getCurrentUser(req);
      expect(getUserByToken).toHaveBeenCalledWith('abc123');
    });
  });

  describe('createToolContext', () => {
    const user = { id: 'u-1', username: 'staff', displayName: 'Staff', roles: ['staff'], tenantId: 't-1' };

    it('tạo đúng ToolContext từ user + sessionId', () => {
      const req = mockRequest({ 'x-request-id': 'req-abc' });
      const ctx = createToolContext(req, user, 'session-1');
      expect(ctx).toEqual({
        userId: 'u-1',
        username: 'staff',
        roles: ['staff'],
        sessionId: 'session-1',
        requestId: 'req-abc'
      });
    });

    it('tự sinh requestId (UUID) khi không có header x-request-id', () => {
      const req = mockRequest({});
      const ctx = createToolContext(req, user, 'session-2');
      expect(ctx.requestId).toMatch(/^[0-9a-f-]{36}$/);
    });
  });
});
