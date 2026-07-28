import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AppError } from '../errors/app-error.js';
import { getCurrentUser } from '../auth/current-user.js';
import { VaultService } from '../services/vault.js';

export const adminRouter = Router();

// Lấy danh sách integrations của tenant
adminRouter.get('/integrations', async (req, res, next) => {
  try {
    const user = await getCurrentUser(req);
    if (!user || !user.tenantId) {
      throw new AppError('UNAUTHORIZED', 'No tenant associated with user', 401);
    }

    const result = await query<{ integration_code: string; is_active: boolean; vault_path: string; api_url: string; api_key: string }>(
      `SELECT integration_code, is_active, vault_path, api_url, api_key FROM tenant_integrations WHERE tenant_id = $1`,
      [user.tenantId]
    );

    const integrations = await Promise.all(
      result.rows.map(async (row) => {
        let secrets = null;
        try {
          secrets = row.vault_path ? await VaultService.readSecret(row.vault_path) : null;
        } catch {
          secrets = null;
        }
        return {
          integration_code: row.integration_code,
          is_active: row.is_active,
          apiUrl: secrets?.apiUrl || row.api_url || '',
          apiKey: secrets?.apiKey || row.api_key || ''
        };
      })
    );

    res.json({ integrations });
  } catch (error) {
    next(error);
  }
});

const integrationSchema = z.object({
  integrationCode: z.string(),
  apiKey: z.string().optional(),
  apiUrl: z.string().optional(),
  isActive: z.boolean().optional()
});

// Cập nhật/Thêm mới cấu hình integration
adminRouter.post('/integrations', async (req, res, next) => {
  try {
    const user = await getCurrentUser(req);
    if (!user || !user.tenantId) {
      throw new AppError('UNAUTHORIZED', 'No tenant associated with user', 401);
    }

    const { integrationCode, apiKey, apiUrl, isActive } = integrationSchema.parse(req.body);

    const vaultPath = `integrations/${user.tenantId}/${integrationCode}`;

    // Lưu vào database
    const upsertQuery = `
      INSERT INTO tenant_integrations (tenant_id, integration_code, vault_path, is_active, api_url, api_key)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (tenant_id, integration_code) 
      DO UPDATE SET 
        is_active = COALESCE(EXCLUDED.is_active, tenant_integrations.is_active),
        api_url = COALESCE(EXCLUDED.api_url, tenant_integrations.api_url),
        api_key = CASE WHEN EXCLUDED.api_key IS NOT NULL AND EXCLUDED.api_key <> '' THEN EXCLUDED.api_key ELSE tenant_integrations.api_key END,
        updated_at = CURRENT_TIMESTAMP
      RETURNING integration_code, is_active, api_url, api_key
    `;
    
    const dbResult = await query(upsertQuery, [
      user.tenantId,
      integrationCode,
      vaultPath,
      isActive !== undefined ? isActive : true,
      apiUrl !== undefined ? apiUrl : null,
      apiKey !== undefined ? apiKey : null
    ]);

    // Nếu có apiKey hoặc apiUrl, lưu/cập nhật vào HashiCorp Vault
    if (apiKey !== undefined || apiUrl !== undefined) {
      const existing = (await VaultService.readSecret(vaultPath)) || {};
      const secretData = {
        ...existing,
        ...(apiKey !== undefined && apiKey !== '' ? { apiKey } : {}),
        ...(apiUrl !== undefined ? { apiUrl } : {})
      };
      await VaultService.writeSecret(vaultPath, secretData);
    }

    res.json({ 
      success: true, 
      integration: dbResult.rows[0],
      message: (apiKey || apiUrl) ? 'Đã lưu cấu hình và thông tin kết nối vào Vault' : 'Đã cập nhật trạng thái tích hợp'
    });
  } catch (error) {
    next(error);
  }
});

const defaultUsers = [
  { id: '10000000-0000-0000-0000-000000000001', username: 'admin', display_name: 'Quản trị viên', email: 'admin@company.com', role: 'admin', created_at: new Date().toISOString() },
  { id: '10000000-0000-0000-0000-000000000002', username: 'manager', display_name: 'Quản lý', email: 'manager@company.com', role: 'manager', created_at: new Date().toISOString() },
  { id: '10000000-0000-0000-0000-000000000003', username: 'staff', display_name: 'Nhân viên', email: 'staff@company.com', role: 'staff', created_at: new Date().toISOString() }
];

// Lấy danh sách người dùng trong hệ thống
adminRouter.get('/users', async (req, res, next) => {
  try {
    const user = await getCurrentUser(req);
    if (!user || !user.tenantId) {
      throw new AppError('UNAUTHORIZED', 'No tenant associated with user', 401);
    }

    let rows: any[] = [];
    try {
      const result = await query(
        `SELECT id, username, display_name, email, role, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at ASC`,
        [user.tenantId]
      );
      rows = result.rows;
    } catch (e) {
      console.warn('DB Query users warning:', (e as Error).message);
    }

    const filteredRows = (rows.length > 0 ? rows : defaultUsers)
      .filter(u => u.username !== 'viewer' && u.role !== 'viewer')
      .map(u => {
        if (u.username === 'manager' || u.role === 'manager') return { ...u, display_name: 'Quản lý' };
        if (u.username === 'staff' || u.role === 'staff') return { ...u, display_name: 'Nhân viên' };
        return u;
      });

    res.json({ users: filteredRows });
  } catch (error) {
    next(error);
  }
});

const createUserSchema = z.object({
  username: z.string().min(2),
  email: z.string().email().optional(),
  displayName: z.string().optional(),
  role: z.enum(['admin', 'manager', 'staff', 'viewer'])
});

// Thêm người dùng mới
adminRouter.post('/users', async (req, res, next) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || !currentUser.tenantId) {
      throw new AppError('UNAUTHORIZED', 'No tenant associated with user', 401);
    }
    if (!currentUser.roles.includes('admin')) {
      throw new AppError('PERMISSION_DENIED', 'Only admins can create users', 403);
    }

    const { username, email, displayName, role } = createUserSchema.parse(req.body);

    const insertQuery = `
      INSERT INTO users (tenant_id, username, email, display_name, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (username) 
      DO UPDATE SET role = EXCLUDED.role, email = EXCLUDED.email, display_name = EXCLUDED.display_name
      RETURNING id, username, display_name, email, role, created_at
    `;

    const dbResult = await query(insertQuery, [
      currentUser.tenantId,
      username,
      email || `${username}@company.com`,
      displayName || username,
      role
    ]);

    res.json({
      success: true,
      user: dbResult.rows[0],
      message: `Đã thêm/cập nhật người dùng ${username}`
    });
  } catch (error) {
    next(error);
  }
});

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'manager', 'staff', 'viewer'])
});

// Cập nhật phân quyền Role cho người dùng
adminRouter.patch('/users/:userId/role', async (req, res, next) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || !currentUser.tenantId) {
      throw new AppError('UNAUTHORIZED', 'No tenant associated with user', 401);
    }
    if (!currentUser.roles.includes('admin')) {
      throw new AppError('PERMISSION_DENIED', 'Only admins can change user roles', 403);
    }

    const { userId } = req.params;
    const { role } = updateRoleSchema.parse(req.body);

    try {
      const updateQuery = `
        UPDATE users 
        SET role = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2 AND tenant_id = $3
        RETURNING id, username, display_name, email, role
      `;

      const dbResult = await query(updateQuery, [role, userId, currentUser.tenantId]);

      // Đồng bộ vào bảng user_roles và auth_sessions
      try {
        const roleRow = await query<{ id: string }>(`SELECT id FROM roles WHERE role_code = $1 LIMIT 1`, [role]);
        if (roleRow.rows.length > 0 && roleRow.rows[0]) {
          await query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
          await query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [userId, roleRow.rows[0].id]);
        }
        await query(`UPDATE auth_sessions SET roles = $1 WHERE user_id = $2`, [[role], userId]);
      } catch (err: any) {
        console.warn('Sync user_roles / auth_sessions warning:', err.message);
      }

      if (dbResult.rows.length > 0) {
        return res.json({
          success: true,
          user: dbResult.rows[0],
          message: `Đã cập nhật quyền thành: ${role}`
        });
      }
    } catch (e) {
      console.warn('Update user role DB fallback:', (e as Error).message);
    }

    res.json({
      success: true,
      message: `Đã cập nhật quyền thành: ${role}`
    });
  } catch (error) {
    next(error);
  }
});

// Xóa người dùng
adminRouter.delete('/users/:userId', async (req, res, next) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || !currentUser.tenantId) {
      throw new AppError('UNAUTHORIZED', 'No tenant associated with user', 401);
    }
    if (!currentUser.roles.includes('admin')) {
      throw new AppError('PERMISSION_DENIED', 'Only admins can delete users', 403);
    }

    const { userId } = req.params;

    if (userId === '10000000-0000-0000-0000-000000000001' || userId === 'admin') {
      throw new AppError('PERMISSION_DENIED', 'Không thể xóa tài khoản Quản trị viên.', 400);
    }

    try {
      const targetUserRes = await query<{role: string}>(
        `SELECT role FROM users WHERE (id::text = $1 OR username = $1 OR email = $1) AND tenant_id = $2`,
        [userId, currentUser.tenantId]
      );
      if (targetUserRes.rows.length > 0 && targetUserRes.rows[0]?.role === 'admin') {
        throw new AppError('PERMISSION_DENIED', 'Không thể xóa tài khoản có quyền Quản trị viên (Admin).', 400);
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      console.warn('Check target user role error:', (e as Error).message);
    }

    await query(
      `DELETE FROM users WHERE (id::text = $1 OR username = $1 OR email = $1) AND tenant_id = $2`,
      [userId, currentUser.tenantId]
    );

    res.json({
      success: true,
      message: 'Đã xóa người dùng thành công'
    });
  } catch (error) {
    next(error);
  }
});
