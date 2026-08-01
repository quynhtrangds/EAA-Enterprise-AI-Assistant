import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pool TRƯỚC khi import module (vi.hoisted đảm bảo mock được đăng ký sớm)
const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../db/pool.js', () => ({ query }));

// Import sau khi mock được đăng ký
const { createAuthSession, getUserByToken, ensureAuthSessionsTable } = await import('./auth-sessions.js');

describe('auth/auth-sessions.ts', () => {
  beforeEach(() => {
    query.mockReset();
  });

  // ─── ensureAuthSessionsTable ────────────────────────────────────────────────

  describe('ensureAuthSessionsTable()', () => {
    it('gọi CREATE TABLE IF NOT EXISTS auth_sessions khi lần đầu được gọi', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      await ensureAuthSessionsTable();

      // Ít nhất 1 lần query được gọi
      expect(query).toHaveBeenCalled();
      const sql: string = query.mock.calls[0][0];
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS auth_sessions/i);
      expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_auth_sessions_token/i);
    });

    it('singleton: sau lần đầu, gọi thêm không thực hiện query mới', async () => {
      // ensureAuthSessionsTable đã được gọi ở test trên → promise được cache
      // Gọi thêm 2 lần nữa: query KHÔNG được gọi thêm
      const callsBefore = query.mock.calls.length;
      await ensureAuthSessionsTable();
      await ensureAuthSessionsTable();
      expect(query.mock.calls.length).toBe(callsBefore);
    });
  });

  // ─── createAuthSession ───────────────────────────────────────────────────────

  describe('createAuthSession()', () => {
    const userId = '10000000-0000-0000-0000-000000000001';
    const roles = ['admin'];

    it('trả về token (64 hex chars) và expiresAt từ DB', async () => {
      const fakeExpiry = '2026-08-02T00:00:00.000Z';
      // ensureAuthSessionsTable → cached (singleton) → không cần mock
      // INSERT auth_session
      query.mockResolvedValueOnce({ rows: [{ expires_at: fakeExpiry }] });

      const result = await createAuthSession(userId, roles);

      expect(result.token).toMatch(/^[a-f0-9]{64}$/);
      expect(result.expiresAt).toBe(fakeExpiry);
    });

    it('INSERT được gọi với đúng userId, roles, TTL=24', async () => {
      const fakeExpiry = '2026-08-02T00:00:00.000Z';
      query.mockResolvedValueOnce({ rows: [{ expires_at: fakeExpiry }] }); // INSERT

      await createAuthSession(userId, roles);

      // Tìm lần gọi INSERT (có param userId ở vị trí [1])
      const insertCall = query.mock.calls.find(
        (c) => Array.isArray(c[1]) && c[1][1] === userId
      );
      expect(insertCall).toBeDefined();
      const params = insertCall![1] as unknown[];
      expect(params[1]).toBe(userId);
      expect(params[2]).toEqual(roles);
      expect(params[3]).toBe(24); // TTL_HOURS
    });

    it('ném Error khi DB không trả về row (INSERT thất bại)', async () => {
      query.mockResolvedValueOnce({ rows: [] }); // INSERT trả về rỗng

      await expect(createAuthSession(userId, roles)).rejects.toThrow('Failed to create auth session.');
    });

    it('mỗi lần tạo session đều sinh token 64 hex ngẫu nhiên khác nhau', async () => {
      const fakeExpiry = '2026-08-02T00:00:00.000Z';
      query.mockResolvedValueOnce({ rows: [{ expires_at: fakeExpiry }] });
      query.mockResolvedValueOnce({ rows: [{ expires_at: fakeExpiry }] });

      const r1 = await createAuthSession(userId, roles);
      const r2 = await createAuthSession(userId, roles);
      expect(r1.token).not.toBe(r2.token);
      expect(r1.token).toMatch(/^[a-f0-9]{64}$/);
      expect(r2.token).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  // ─── getUserByToken ──────────────────────────────────────────────────────────

  describe('getUserByToken()', () => {
    it('trả về null khi không tìm thấy session hợp lệ', async () => {
      query.mockResolvedValueOnce({ rows: [] }); // SELECT trả rỗng

      const result = await getUserByToken('token-khong-ton-tai');
      expect(result).toBeNull();
    });

    it('trả về đúng AuthenticatedSessionUser khi token hợp lệ', async () => {
      const dbRow = {
        user_id: 'u-123',
        username: 'admin',
        display_name: 'Quản trị viên',
        roles: ['admin'],
        tenant_id: 't-001'
      };
      query.mockResolvedValueOnce({ rows: [dbRow] });

      const user = await getUserByToken('valid-hex-token');

      expect(user).toEqual({
        id: 'u-123',
        username: 'admin',
        displayName: 'Quản trị viên',
        roles: ['admin'],
        tenantId: 't-001'
      });
    });

    it('query SELECT được gọi với đúng token', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await getUserByToken('my-secret-token-abc');

      // Tìm call có token là tham số
      const selectCall = query.mock.calls.find(
        (c) => Array.isArray(c[1]) && c[1][0] === 'my-secret-token-abc'
      );
      expect(selectCall).toBeDefined();
    });

    it('SQL SELECT bao gồm điều kiện revoked_at IS NULL, expires_at > now(), status = active', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await getUserByToken('any-token');

      // Tìm call SELECT (có param là token)
      const selectCall = query.mock.calls.find(
        (c) => Array.isArray(c[1]) && c[1][0] === 'any-token'
      );
      expect(selectCall).toBeDefined();
      const sql: string = selectCall![0];
      expect(sql).toMatch(/revoked_at IS NULL/i);
      expect(sql).toMatch(/expires_at > now\(\)/i);
      expect(sql).toMatch(/u\.status = 'active'/i);
    });

    it('trả về null khi user bị block (SQL lọc bởi status=active → rows rỗng)', async () => {
      query.mockResolvedValueOnce({ rows: [] }); // SQL filter user blocked → rỗng

      const result = await getUserByToken('token-of-blocked-user');
      expect(result).toBeNull();
    });
  });
});
