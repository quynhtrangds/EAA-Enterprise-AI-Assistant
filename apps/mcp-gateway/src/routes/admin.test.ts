import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { query, getCurrentUser, readSecret, writeSecret } = vi.hoisted(() => ({
  query: vi.fn(),
  getCurrentUser: vi.fn(),
  readSecret: vi.fn(),
  writeSecret: vi.fn()
}));

vi.mock('../db/pool.js', () => ({ query }));
vi.mock('../services/vault.js', () => ({
  VaultService: { readSecret, writeSecret }
}));

vi.mock('../audit/audit-log.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../auth/current-user.js', () => ({
  getCurrentUser
}));

vi.mock('../connectors/mcp-client-manager.js', () => ({
  mcpClientManager: {
    initialize: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
    getConfiguredServerNames: vi.fn().mockReturnValue(['gitea', 'erpnext', 'zammad', 'crm', 'rag', 'postgres']),
    ping: vi.fn().mockResolvedValue(true)
  }
}));

import { createApp } from '../app.js';
import { AppError } from '../errors/app-error.js';

describe('Admin Routes Integration Suite', () => {
  const adminUser = {
    id: '10000000-0000-0000-0000-000000000001',
    username: 'admin',
    displayName: 'Quản trị viên',
    roles: ['admin'],
    tenantId: '00000000-0000-0000-0000-000000000000'
  };

  const staffUser = {
    id: '10000000-0000-0000-0000-000000000003',
    username: 'staff',
    displayName: 'Nhân viên',
    roles: ['staff'],
    tenantId: '00000000-0000-0000-0000-000000000000'
  };

  beforeEach(() => {
    query.mockReset();
    getCurrentUser.mockReset();
    readSecret.mockReset().mockResolvedValue(null);
    writeSecret.mockReset().mockResolvedValue(undefined);
  });

  describe('GET /api/admin/users', () => {
    it('rejects unauthenticated requests missing Bearer token', async () => {
      getCurrentUser.mockRejectedValue(
        new AppError('UNAUTHORIZED', 'Ban phai cung cap header Authorization: Bearer <token>.', 401)
      );

      const response = await request(createApp())
        .get('/api/admin/users')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED'
      });
    });

    it('returns user list for authenticated user', async () => {
      getCurrentUser.mockResolvedValue(adminUser);
      query.mockResolvedValueOnce({
        rows: [
          { id: adminUser.id, username: 'admin', display_name: 'Quản trị viên', email: 'admin@company.com', role: 'admin', created_at: new Date().toISOString() },
          { id: staffUser.id, username: 'staff', display_name: 'Nhân viên', email: 'staff@company.com', role: 'staff', created_at: new Date().toISOString() }
        ]
      });

      const response = await request(createApp())
        .get('/api/admin/users')
        .set('Authorization', 'Bearer valid-admin-token')
        .expect(200);

      expect(response.body.users).toHaveLength(2);
      expect(response.body.users[0].username).toBe('admin');
    });
  });

  describe('POST /api/admin/users', () => {
    it('forbids non-admin users from creating users', async () => {
      getCurrentUser.mockResolvedValue(staffUser);

      const response = await request(createApp())
        .post('/api/admin/users')
        .set('Authorization', 'Bearer valid-staff-token')
        .send({ username: 'newuser', role: 'staff' })
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'PERMISSION_DENIED'
      });
    });

    it('allows admin to create a new user', async () => {
      getCurrentUser.mockResolvedValue(adminUser);
      query
        .mockResolvedValueOnce({ rows: [{ role_code: 'staff' }] }) // assertValidRoleCode
        .mockResolvedValueOnce({
          rows: [{ id: '10000000-0000-0000-0000-000000000005', username: 'newuser', display_name: 'newuser', email: 'newuser@company.com', role: 'staff' }]
        }) // INSERT INTO users
        .mockResolvedValueOnce({ rows: [{ id: 'role-uuid-staff' }] }) // SELECT roles.id để đồng bộ user_roles
        .mockResolvedValueOnce({ rows: [] }) // DELETE user_roles
        .mockResolvedValueOnce({ rows: [] }); // INSERT user_roles

      const response = await request(createApp())
        .post('/api/admin/users')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ username: 'newuser', role: 'staff' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        user: { username: 'newuser', role: 'staff' }
      });
    });

    it('trả 400 khi role không tồn tại trong bảng roles (validate động, không còn hard-code enum)', async () => {
      getCurrentUser.mockResolvedValue(adminUser);
      query.mockResolvedValueOnce({ rows: [] }); // assertValidRoleCode: không tìm thấy role_code

      const response = await request(createApp())
        .post('/api/admin/users')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ username: 'newuser', role: 'khong-ton-tai' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'INVALID_TOOL_INPUT'
      });
    });
  });

  describe('PATCH /api/admin/users/:userId/role', () => {
    it('trả 400 khi role không tồn tại trong bảng roles', async () => {
      getCurrentUser.mockResolvedValue(adminUser);
      query.mockResolvedValueOnce({ rows: [] }); // assertValidRoleCode: không tìm thấy

      const response = await request(createApp())
        .patch(`/api/admin/users/${staffUser.id}/role`)
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role: 'khong-ton-tai' })
        .expect(400);

      expect(response.body.errorCode).toBe('INVALID_TOOL_INPUT');
    });

    it('trả 400 khi cố đổi role của tài khoản guest dùng chung', async () => {
      getCurrentUser.mockResolvedValue(adminUser);
      query.mockResolvedValueOnce({ rows: [{ role_code: 'staff' }] }); // assertValidRoleCode

      const response = await request(createApp())
        .patch('/api/admin/users/10000000-0000-0000-0000-000000000004/role')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role: 'staff' })
        .expect(400);

      expect(response.body.errorCode).toBe('PERMISSION_DENIED');
    });

    it('trả 400 khi cố hạ quyền admin cuối cùng của tenant', async () => {
      getCurrentUser.mockResolvedValue(adminUser);
      query
        .mockResolvedValueOnce({ rows: [{ role_code: 'staff' }] }) // assertValidRoleCode
        .mockResolvedValueOnce({ rows: [{ id: adminUser.id, role: 'admin' }] }) // targetUserRes: target đang là admin
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // chỉ còn đúng 1 admin

      const response = await request(createApp())
        .patch(`/api/admin/users/${adminUser.id}/role`)
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role: 'staff' })
        .expect(400);

      expect(response.body.errorCode).toBe('PERMISSION_DENIED');
    });

    it('cho phép hạ quyền admin nếu còn admin khác trong tenant', async () => {
      getCurrentUser.mockResolvedValue(adminUser);
      query
        .mockResolvedValueOnce({ rows: [{ role_code: 'staff' }] }) // assertValidRoleCode
        .mockResolvedValueOnce({ rows: [{ id: adminUser.id, role: 'admin' }] }) // targetUserRes
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // còn 2 admin
        .mockResolvedValueOnce({ rows: [{ id: adminUser.id, username: 'admin', display_name: 'Quản trị viên', email: 'admin@company.com', role: 'staff' }] }) // UPDATE
        .mockResolvedValueOnce({ rows: [{ id: 'role-uuid-staff' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(createApp())
        .patch(`/api/admin/users/${adminUser.id}/role`)
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role: 'staff' })
        .expect(200);

      expect(response.body.user.role).toBe('staff');
    });

    it('returns 404 when target user is not found in tenant', async () => {
      getCurrentUser.mockResolvedValue(adminUser);
      query
        .mockResolvedValueOnce({ rows: [{ role_code: 'manager' }] }) // assertValidRoleCode
        .mockResolvedValueOnce({ rows: [] }) // targetUserRes: không tìm thấy → bỏ qua check tự-khóa
        .mockResolvedValueOnce({ rows: [] }); // UPDATE: không tìm thấy → NOT_FOUND

      const response = await request(createApp())
        .patch('/api/admin/users/non-existent-user/role')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role: 'manager' })
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'NOT_FOUND'
      });
    });

    it('updates user role successfully for valid user in tenant', async () => {
      getCurrentUser.mockResolvedValue(adminUser);
      const targetUserId = staffUser.id;

      query
        .mockResolvedValueOnce({ rows: [{ role_code: 'manager' }] }) // assertValidRoleCode
        .mockResolvedValueOnce({ rows: [{ id: targetUserId, role: 'staff' }] }) // targetUserRes: staff, không phải admin nên bỏ qua check đếm
        .mockResolvedValueOnce({ rows: [{ id: targetUserId, username: 'staff', display_name: 'Nhân viên', email: 'staff@company.com', role: 'manager' }] }) // UPDATE
        .mockResolvedValueOnce({ rows: [{ id: 'role-uuid-manager' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(createApp())
        .patch(`/api/admin/users/${targetUserId}/role`)
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role: 'manager' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        user: { id: targetUserId, role: 'manager' },
        message: 'Đã cập nhật quyền thành: manager'
      });
    });
  });

  describe('DELETE /api/admin/users/:userId', () => {
    it('prevents deleting admin account', async () => {
      getCurrentUser.mockResolvedValue(adminUser);

      const response = await request(createApp())
        .delete('/api/admin/users/admin')
        .set('Authorization', 'Bearer valid-admin-token')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'PERMISSION_DENIED'
      });
    });

    it('prevents deleting the shared guest account', async () => {
      getCurrentUser.mockResolvedValue(adminUser);

      const response = await request(createApp())
        .delete('/api/admin/users/10000000-0000-0000-0000-000000000004')
        .set('Authorization', 'Bearer valid-admin-token')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'PERMISSION_DENIED'
      });
      // Không được chạm DB vì phải chặn trước khi query
      expect(query).not.toHaveBeenCalled();
    });
  });
  describe('POST /api/admin/integrations - SSRF Protection', () => {
    it('chặn cấu hình URL trỏ vào Cloud Metadata 169.254.169.254 (400)', async () => {
      getCurrentUser.mockResolvedValue(adminUser);

      const response = await request(createApp())
        .post('/api/admin/integrations')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          integrationCode: 'erpnext',
          apiUrl: 'http://169.254.169.254/latest/meta-data',
          isActive: true
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'INVALID_TOOL_INPUT'
      });
      expect(query).not.toHaveBeenCalled();
    });

    it('chặn cấu hình URL trỏ vào dịch vụ nội bộ nhạy cảm Vault :8200 (400)', async () => {
      getCurrentUser.mockResolvedValue(adminUser);

      const response = await request(createApp())
        .post('/api/admin/integrations')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          integrationCode: 'crm',
          apiUrl: 'http://vault:8200/v1/sys/seal-status',
          isActive: true
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'INVALID_TOOL_INPUT'
      });
      expect(query).not.toHaveBeenCalled();
    });

    it('chấp nhận URL hợp lệ và lưu vào database (200)', async () => {
      getCurrentUser.mockResolvedValue(adminUser);
      query.mockResolvedValueOnce({
        rows: [{ integration_code: 'erpnext', is_active: true, api_url: 'https://mycompany.frappe.cloud' }]
      });

      const response = await request(createApp())
        .post('/api/admin/integrations')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          integrationCode: 'erpnext',
          apiUrl: 'https://mycompany.frappe.cloud',
          isActive: true
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Đã lưu cấu hình và thông tin kết nối vào Vault'
      });
      expect(query).toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/integrations/:code/test - Test Saved Integration', () => {
    it('từ chối người dùng không có role admin (403)', async () => {
      getCurrentUser.mockResolvedValue(staffUser);

      const response = await request(createApp())
        .post('/api/admin/integrations/gitea/test')
        .set('Authorization', 'Bearer valid-staff-token')
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'PERMISSION_DENIED'
      });
    });

    it('trả về kết quả test integration đã lưu (200)', async () => {
      getCurrentUser.mockResolvedValue(adminUser);
      query.mockResolvedValueOnce({
        rows: [{
          id: 'int-001',
          tenant_id: adminUser.tenantId,
          integration_code: 'postgres',
          vault_path: null,
          api_url: null,
          is_active: true
        }]
      });
      // Mock db query for postgres strategy ping and status update
      query.mockResolvedValueOnce({ rows: [{ ping: 1 }] });
      query.mockResolvedValueOnce({ rowCount: 1 });

      const response = await request(createApp())
        .post('/api/admin/integrations/postgres/test')
        .set('Authorization', 'Bearer valid-admin-token')
        .expect(200);

      expect(response.body).toMatchObject({
        integrationCode: 'postgres',
        overallStatus: 'passed'
      });
      expect(response.body.steps).toBeInstanceOf(Array);
    });
  });

  describe('POST /api/admin/integrations/test - Test Draft Integration', () => {
    it('chặn SSRF khi test draft trỏ vào metadata service 169.254.169.254 (400)', async () => {
      getCurrentUser.mockResolvedValue(adminUser);

      const response = await request(createApp())
        .post('/api/admin/integrations/test')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          integrationCode: 'gitea',
          apiUrl: 'http://169.254.169.254/latest/meta-data',
          apiKey: 'test-token'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'INVALID_TOOL_INPUT'
      });
    });

    it('chạy test draft thành công với URL hợp lệ (200)', async () => {
      getCurrentUser.mockResolvedValue(adminUser);
      query.mockResolvedValueOnce({ rows: [{ ping: 1 }] });

      const response = await request(createApp())
        .post('/api/admin/integrations/test')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          integrationCode: 'postgres'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        integrationCode: 'postgres',
        overallStatus: 'passed'
      });
    });
  });

});
