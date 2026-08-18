import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { query, getCurrentUser } = vi.hoisted(() => ({
  query: vi.fn(),
  getCurrentUser: vi.fn()
}));

vi.mock('../db/pool.js', () => ({ query }));

vi.mock('../auth/current-user.js', () => ({
  getCurrentUser
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
});