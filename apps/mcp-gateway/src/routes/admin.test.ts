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
      query.mockResolvedValueOnce({
        rows: [{ id: '10000000-0000-0000-0000-000000000005', username: 'newuser', display_name: 'newuser', email: 'newuser@company.com', role: 'staff' }]
      });

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
  });

  describe('PATCH /api/admin/users/:userId/role', () => {
    it('returns 404 when target user is not found in tenant', async () => {
      getCurrentUser.mockResolvedValue(adminUser);
      query.mockResolvedValueOnce({ rows: [] });

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

      query.mockResolvedValueOnce({
        rows: [{ id: targetUserId, username: 'staff', display_name: 'Nhân viên', email: 'staff@company.com', role: 'manager' }]
      });
      query.mockResolvedValueOnce({ rows: [{ id: 'role-uuid-manager' }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

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
  });
});
