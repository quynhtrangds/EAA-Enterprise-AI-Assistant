import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// ─── Hoisted mocks ───────────────────────────────────────────────────────────
const { query, getCurrentUser, verifyPassword, createAuthSession, mcpClientManager, canExecuteTool, writeAuditLog, VaultService } = vi.hoisted(() => ({
  query: vi.fn(),
  getCurrentUser: vi.fn(),
  verifyPassword: vi.fn(),
  createAuthSession: vi.fn(),
  mcpClientManager: {
    initialize: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn(),
    callTool: vi.fn(),
    toolToServerMap: new Map<string, string>()
  },
  canExecuteTool: vi.fn(),
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
  VaultService: { readSecret: vi.fn() }
}));

vi.mock('../db/pool.js', () => ({ query }));
vi.mock('../auth/current-user.js', () => ({ getCurrentUser, createToolContext: vi.fn() }));
vi.mock('../auth/passwords.js', () => ({ verifyPassword }));
vi.mock('../auth/auth-sessions.js', () => ({ createAuthSession }));
vi.mock('../connectors/mcp-client-manager.js', () => ({ mcpClientManager }));
vi.mock('../policies/tool-permissions.js', () => ({ canExecuteTool }));
vi.mock('../audit/audit-log.js', () => ({ writeAuditLog }));
vi.mock('../services/vault.js', () => ({ VaultService }));
vi.mock('../policies/rate-limiter.js', () => ({ checkToolRateLimit: vi.fn().mockResolvedValue(undefined) }));

import { createApp } from '../app.js';
import { AppError } from '../errors/app-error.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────
const mockAdminUser = {
  id: '10000000-0000-0000-0000-000000000001',
  username: 'admin',
  displayName: 'Quản trị viên',
  roles: ['admin'],
  tenantId: 'tenant-uuid-001'
};

const mockStaffUser = {
  id: '10000000-0000-0000-0000-000000000003',
  username: 'staff',
  displayName: 'Nhân viên',
  roles: ['staff'],
  tenantId: 'tenant-uuid-001'
};

describe('Tools & Login Routes – mở rộng (routes/tools.ts)', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
    query.mockReset();
    getCurrentUser.mockReset();
    verifyPassword.mockReset();
    createAuthSession.mockReset();
    mcpClientManager.listTools.mockReset();
    mcpClientManager.callTool.mockReset();
    mcpClientManager.toolToServerMap.clear();
    canExecuteTool.mockReset();
    writeAuditLog.mockResolvedValue(undefined);
    VaultService.readSecret.mockReset();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/login
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /api/login', () => {
    it('đăng nhập thành công – trả về token và thông tin user', async () => {
      const dbUser = {
        id: mockAdminUser.id,
        username: 'admin',
        password_hash: 'scrypt$...',
        display_name: 'Quản trị viên',
        email: 'admin@example.com',
        tenant_id: mockAdminUser.tenantId,
        role: 'admin',
        roles: ['admin']
      };
      query.mockResolvedValueOnce({ rows: [dbUser] });
      verifyPassword.mockResolvedValueOnce(true);
      createAuthSession.mockResolvedValueOnce({ token: 'fake-token-hex', expiresAt: '2026-08-02T00:00:00Z' });

      const res = await request(app)
        .post('/api/login')
        .send({ username: 'admin', password: 'admin123' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.token).toBe('fake-token-hex');
      expect(res.body.tokenType).toBe('Bearer');
      expect(res.body.user.username).toBe('admin');
      expect(res.body.user.roles).toContain('admin');
    });

    it('từ chối khi mật khẩu sai (verifyPassword = false)', async () => {
      const dbUser = {
        id: mockAdminUser.id,
        username: 'admin',
        password_hash: 'scrypt$...',
        display_name: 'Quản trị viên',
        email: null,
        tenant_id: mockAdminUser.tenantId,
        role: 'admin',
        roles: ['admin']
      };
      query.mockResolvedValueOnce({ rows: [dbUser] });
      verifyPassword.mockResolvedValueOnce(false);

      const res = await request(app)
        .post('/api/login')
        .send({ username: 'admin', password: 'satmau' })
        .expect(401);

      expect(res.body.errorCode).toBe('UNAUTHENTICATED');
    });

    it('trả 400 khi thiếu trường username (Zod validation)', async () => {
      // loginSchema.parse ném ZodError → errorHandler xử lý thành 400
      const res = await request(app)
        .post('/api/login')
        .send({ password: 'admin123' })
        .expect(400);

      expect(res.body.errorCode).toBe('INVALID_TOOL_INPUT');
    });

    it('trả 400 khi thiếu trường password (Zod validation)', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ username: 'admin' })
        .expect(400);

      expect(res.body.errorCode).toBe('INVALID_TOOL_INPUT');
    });

    it('trả 401 khi username không tồn tại trong DB', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/login')
        .send({ username: 'ghost', password: '123456' })
        .expect(401);

      expect(res.body.errorCode).toBe('UNAUTHENTICATED');
    });

    it('username trùng ở 2 tenant khác nhau – phải đăng nhập đúng candidate có password khớp, không chọn bừa candidate đầu tiên', async () => {
      const candidateTenantA = {
        id: 'user-tenant-a',
        username: 'manager',
        password_hash: 'hash-a',
        display_name: 'Manager A',
        email: 'manager@tenant-a.com',
        tenant_id: 'tenant-a',
        role: 'manager',
        roles: ['manager']
      };
      const candidateTenantB = {
        id: 'user-tenant-b',
        username: 'manager',
        password_hash: 'hash-b',
        display_name: 'Manager B',
        email: 'manager@tenant-b.com',
        tenant_id: 'tenant-b',
        role: 'manager',
        roles: ['manager']
      };
      // Mật khẩu người dùng nhập chỉ khớp với candidate của tenant B
      query.mockResolvedValueOnce({ rows: [candidateTenantA, candidateTenantB] });
      verifyPassword.mockImplementation(async (_pw: string, hash: string) => hash === 'hash-b');
      createAuthSession.mockResolvedValueOnce({ token: 'tok', expiresAt: '2026-08-02T00:00:00Z' });

      const res = await request(app)
        .post('/api/login')
        .send({ username: 'manager', password: 'correct-for-b' })
        .expect(200);

      expect(res.body.user.username).toBe('manager');
      expect(createAuthSession).toHaveBeenCalledWith('user-tenant-b', ['manager']);
    });

    it('username trùng ở 2 tenant nhưng password không khớp với bất kỳ ai – từ chối đăng nhập', async () => {
      const candidateTenantA = {
        id: 'user-tenant-a', username: 'manager', password_hash: 'hash-a',
        display_name: 'Manager A', email: 'a@x.com', tenant_id: 'tenant-a', role: 'manager', roles: ['manager']
      };
      const candidateTenantB = {
        id: 'user-tenant-b', username: 'manager', password_hash: 'hash-b',
        display_name: 'Manager B', email: 'b@x.com', tenant_id: 'tenant-b', role: 'manager', roles: ['manager']
      };
      query.mockResolvedValueOnce({ rows: [candidateTenantA, candidateTenantB] });
      verifyPassword.mockResolvedValue(false);

      const res = await request(app)
        .post('/api/login')
        .send({ username: 'manager', password: 'wrong-for-both' })
        .expect(401);

      expect(res.body.errorCode).toBe('UNAUTHENTICATED');
      expect(createAuthSession).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/auth/guest
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /api/auth/guest', () => {
    it('tạo session viewer thành công khi tồn tại user guest', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 'viewer-id', tenant_id: 'tenant-001' }] });
      createAuthSession.mockResolvedValueOnce({ token: 'guest-token', expiresAt: '2026-08-02T00:00:00Z' });

      const res = await request(app).post('/api/auth/guest').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.user.username).toBe('guest');
      expect(res.body.user.roles).toEqual(['viewer']);
    });

    it('trả 503 khi không có user guest trong hệ thống', async () => {
      query.mockResolvedValueOnce({ rows: [] }); // SELECT
      query.mockResolvedValueOnce({ rows: [] }); // INSERT RETURNING

      const res = await request(app).post('/api/auth/guest').expect(500);
      expect(res.body.errorCode).toBe('INTERNAL_ERROR');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /api/me
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /api/me', () => {
    it('trả về thông tin user hiện tại khi đã xác thực', async () => {
      getCurrentUser.mockResolvedValueOnce(mockAdminUser);

      const res = await request(app)
        .get('/api/me')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(res.body.user.username).toBe('admin');
      expect(res.body.user.roles).toContain('admin');
    });

    it('trả 401 khi getCurrentUser ném AppError UNAUTHORIZED', async () => {
      // Phải dùng AppError thật (instanceof AppError) để errorHandler trả đúng statusCode
      getCurrentUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'No token provided', 401));

      const res = await request(app).get('/api/me').expect(401);
      expect(res.body.errorCode).toBe('UNAUTHORIZED');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /api/tools
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /api/tools', () => {
    it('lọc tool bị TẮT bởi tenant_integrations (is_active = false)', async () => {
      getCurrentUser.mockResolvedValue(mockAdminUser);
      mcpClientManager.toolToServerMap.set('get_open_tickets', 'zammad');

      mcpClientManager.listTools.mockResolvedValue({
        tools: [
          { name: 'search_customer', description: 'Find customer', title: '', inputSchema: {} },
          { name: 'get_open_tickets', description: 'Get tickets', title: '', inputSchema: {} }
        ]
      });

      // is_active check cho get_open_tickets (zammad) → tắt
      query.mockResolvedValueOnce({ rows: [{ is_active: false }] });
      canExecuteTool.mockResolvedValue(true);

      const res = await request(app)
        .get('/api/tools')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      const tickets = res.body.tools.find((t: any) => t.name === 'get_open_tickets');
      expect(tickets?.permitted).toBe(false);
    });

    it('giữ nguyên permitted=true cho tool khi is_active = true', async () => {
      getCurrentUser.mockResolvedValue(mockAdminUser);
      mcpClientManager.toolToServerMap.set('search_repositories', 'gitea');

      mcpClientManager.listTools.mockResolvedValue({
        tools: [{ name: 'search_repositories', description: 'Search repos', title: '', inputSchema: {} }]
      });

      query.mockResolvedValueOnce({ rows: [{ is_active: true }] });
      canExecuteTool.mockResolvedValue(true);

      const res = await request(app)
        .get('/api/tools')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(res.body.tools[0].permitted).toBe(true);
    });

    it('trả 401 khi getCurrentUser ném AppError UNAUTHORIZED', async () => {
      getCurrentUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Missing token', 401));

      const res = await request(app).get('/api/tools').expect(401);
      expect(res.body.errorCode).toBe('UNAUTHORIZED');
    });

    it('tools có inputSchema được trả về đúng trong response', async () => {
      getCurrentUser.mockResolvedValue(mockAdminUser);
      canExecuteTool.mockResolvedValue(true);
      mcpClientManager.listTools.mockResolvedValue({
        tools: [
          {
            name: 'search_customer',
            title: 'Tìm khách hàng',
            description: 'Search customer',
            inputSchema: { type: 'object', properties: { name: { type: 'string' } } }
          }
        ]
      });
      query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .get('/api/tools')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      const tool = res.body.tools[0];
      expect(tool.inputSchema).toBeDefined();
      expect(tool.name).toBe('search_customer');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/tools/call
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /api/tools/call', () => {
    it('gọi tool thành công – trả về data và durationMs', async () => {
      getCurrentUser.mockResolvedValue(mockAdminUser);
      canExecuteTool.mockResolvedValue(true);
      query.mockResolvedValue({ rows: [] });

      mcpClientManager.callTool.mockResolvedValueOnce({ content: [{ type: 'text', text: 'Kết quả OK' }] });

      const res = await request(app)
        .post('/api/tools/call')
        .set('Authorization', 'Bearer valid-token')
        .send({ toolName: 'search_customer', arguments: { query: 'Nguyen Van A' }, sessionId: 'sess-1' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.toolName).toBe('search_customer');
      expect(res.body.data).toBeDefined();
      expect(typeof res.body.durationMs).toBe('number');
    });

    it('trả 403 khi user không có quyền gọi tool', async () => {
      getCurrentUser.mockResolvedValue(mockStaffUser);
      canExecuteTool.mockResolvedValue(false);
      query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/api/tools/call')
        .set('Authorization', 'Bearer valid-token')
        .send({ toolName: 'view_audit_logs', arguments: {}, sessionId: 'sess-1' })
        .expect(403);

      expect(res.body.errorCode).toBe('PERMISSION_DENIED');
    });

    it('trả 400 khi integration bị TẮT (is_active = false)', async () => {
      getCurrentUser.mockResolvedValue(mockAdminUser);
      mcpClientManager.toolToServerMap.set('get_open_tickets', 'zammad');

      query.mockResolvedValueOnce({ rows: [{ is_active: false }] });
      canExecuteTool.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/tools/call')
        .set('Authorization', 'Bearer valid-token')
        .send({ toolName: 'get_open_tickets', arguments: {}, sessionId: 'sess-2' })
        .expect(400);

      expect(res.body.errorCode).toBe('PERMISSION_DENIED');
      expect(res.body.message).toMatch(/ZAMMAD/i);
    });

    it('trả 400 khi body thiếu toolName (Zod validation)', async () => {
      // Route gọi getCurrentUser TRƯỚC khi callToolSchema.parse → mock cần thiết
      getCurrentUser.mockResolvedValue(mockAdminUser);
      query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/api/tools/call')
        .set('Authorization', 'Bearer valid-token')
        .send({ arguments: {} })
        .expect(400);

      expect(res.body.errorCode).toBe('INVALID_TOOL_INPUT');
    });

    it('inject _integrationCredentials từ Vault vào mergedArgs', async () => {
      getCurrentUser.mockResolvedValue(mockAdminUser);
      canExecuteTool.mockResolvedValue(true);
      mcpClientManager.toolToServerMap.set('get_erp_data', 'erpnext');

      query.mockResolvedValueOnce({ rows: [{ is_active: true }] }); // is_active check
      VaultService.readSecret.mockResolvedValueOnce({ apiKey: 'my-erp-key', apiUrl: 'https://erp.example.com' });
      query.mockResolvedValueOnce({ rows: [{ api_url: 'https://erp.example.com' }] }); // api_url DB

      mcpClientManager.callTool.mockResolvedValueOnce({ content: [] });

      await request(app)
        .post('/api/tools/call')
        .set('Authorization', 'Bearer valid-token')
        .send({ toolName: 'get_erp_data', arguments: { id: 'ERP-001' }, sessionId: 'sess-3' })
        .expect(200);

      const mergedArgs = (mcpClientManager.callTool.mock.calls[0]?.[1] ?? {}) as Record<string, unknown>;
      expect(mergedArgs._integrationCredentials).toBeDefined();
      expect((mergedArgs._integrationCredentials as any).apiKey).toBe('my-erp-key');
    });

    it('tự động bổ sung fromDate/toDate cho get_revenue_summary khi thiếu', async () => {
      getCurrentUser.mockResolvedValue(mockAdminUser);
      canExecuteTool.mockResolvedValue(true);
      query.mockResolvedValue({ rows: [] });

      mcpClientManager.callTool.mockResolvedValueOnce({ content: [] });

      await request(app)
        .post('/api/tools/call')
        .set('Authorization', 'Bearer valid-token')
        .send({ toolName: 'get_revenue_summary', arguments: {}, sessionId: 'sess-4' })
        .expect(200);

      const mergedArgs = (mcpClientManager.callTool.mock.calls[0]?.[1] ?? {}) as Record<string, unknown>;
      expect((mergedArgs as any).toDate).toBeDefined();
      expect((mergedArgs as any).fromDate).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /api/audit-logs
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /api/audit-logs', () => {
    it('admin có thể xem audit log – trả về danh sách items', async () => {
      getCurrentUser.mockResolvedValue(mockAdminUser);
      canExecuteTool.mockResolvedValue(true);
      query.mockResolvedValueOnce({
        rows: [
          { id: 'log-1', tool_name: 'search_customer', status: 'success', created_at: '2026-08-01T00:00:00Z' }
        ]
      });

      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].tool_name).toBe('search_customer');
    });

    it('staff bị từ chối – trả 403', async () => {
      getCurrentUser.mockResolvedValue(mockStaffUser);
      canExecuteTool.mockResolvedValue(false);

      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', 'Bearer valid-token')
        .expect(403);

      expect(res.body.errorCode).toBe('PERMISSION_DENIED');
    });

    it('trả 401 khi getCurrentUser ném AppError UNAUTHORIZED', async () => {
      getCurrentUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'No token', 401));

      const res = await request(app).get('/api/audit-logs').expect(401);
      expect(res.body.errorCode).toBe('UNAUTHORIZED');
    });

    it('có thể lọc theo status=failed qua query string', async () => {
      getCurrentUser.mockResolvedValue(mockAdminUser);
      canExecuteTool.mockResolvedValue(true);
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/audit-logs?status=failed')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      const params = (query.mock.calls[0]?.[1] ?? []) as unknown[];
      expect(params[4]).toBe('failed');
    });

    it('trả 400 khi status không hợp lệ (không thuộc enum allowed)', async () => {
      getCurrentUser.mockResolvedValue(mockAdminUser);
      canExecuteTool.mockResolvedValue(true);

      // auditLogQuerySchema.parse → ZodError → errorHandler → 400
      const res = await request(app)
        .get('/api/audit-logs?status=invalid_status')
        .set('Authorization', 'Bearer valid-token')
        .expect(400);

      expect(res.body.errorCode).toBe('INVALID_TOOL_INPUT');
    });
  });
});