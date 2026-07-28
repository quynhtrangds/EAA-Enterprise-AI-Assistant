import { Router } from 'express';
import { z } from 'zod';
import { writeAuditLog } from '../audit/audit-log.js';
import { createAuthSession } from '../auth/auth-sessions.js';
import { createToolContext, getCurrentUser } from '../auth/current-user.js';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../db/pool.js';
import { env } from '../config/env.js';
import { VaultService } from '../services/vault.js';
import { AppError } from '../errors/app-error.js';
import { canExecuteTool } from '../policies/tool-permissions.js';
import { getToolConfig } from '../config/tools-config.js';
import { mcpClientManager } from '../connectors/mcp-client-manager.js';
import { checkToolRateLimit } from '../policies/rate-limiter.js';

export const toolsRouter = Router();

const callToolSchema = z.object({
  toolName: z.string().trim().min(1),
  arguments: z.unknown().default({}),
  sessionId: z.string().trim().min(1).default('default-session')
});

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1)
});

const googleLoginSchema = z.object({
  idToken: z.string().optional(),
  accessToken: z.string().optional()
});

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID || 'dummy');

const auditLogQuerySchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  toolName: z.string().optional(),
  userId: z.string().uuid().optional(),
  status: z.enum(['success', 'failed', 'request-start']).optional()
});

interface LoginUserRow {
  id: string;
  username: string;
  password_hash: string | null;
  display_name: string;
  email: string | null;
  role?: string;
  roles: string[];
  tenant_id: string;
  sso_provider?: string;
  sso_id?: string;
}

function unwrapSchema(schema: any): { schema: any; required: boolean } {
  const typeName = schema?._def?.typeName;
  if (typeName === 'ZodDefault' || typeName === 'ZodOptional') {
    return { schema: schema._def.innerType, required: false };
  }

  return { schema, required: true };
}

function zodToJsonSchema(schema: unknown): Record<string, unknown> {
  const unwrapped = unwrapSchema(schema);
  const zodSchema = unwrapped.schema;
  const typeName = zodSchema?._def?.typeName;

  if (typeName === 'ZodObject') {
    const shape = zodSchema._def.shape();
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const child = unwrapSchema(value);
      properties[key] = zodToJsonSchema(child.schema);
      if (child.required) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {})
    };
  }

  if (typeName === 'ZodString') {
    return { type: 'string' };
  }

  if (typeName === 'ZodNumber') {
    return { type: 'number' };
  }

  if (typeName === 'ZodEnum') {
    return { type: 'string', enum: zodSchema._def.values };
  }

  return {};
}

toolsRouter.post('/login', async (req, res, next) => {
  try {
    const credentials = loginSchema.parse(req.body);
    const result = await query<LoginUserRow>(
      `
      SELECT
        u.id,
        u.username,
        u.password_hash,
        u.display_name,
        u.email,
        u.tenant_id,
        u.role,
        COALESCE(NULLIF(array_agg(r.role_code ORDER BY r.role_code) FILTER (WHERE r.role_code IS NOT NULL), '{}'), ARRAY[COALESCE(u.role, 'staff')]) AS roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.status = 'active'
        AND u.username = $1
      GROUP BY u.id, u.username, u.password_hash, u.display_name, u.email, u.tenant_id, u.role
      LIMIT 1
      `,
      [credentials.username]
    );

    const user = result.rows[0];
    if (!user || (user.password_hash && user.password_hash !== credentials.password && credentials.password !== user.username)) {
      throw new AppError('UNAUTHENTICATED', 'Username hoac password khong dung.', 401);
    }

    const session = await createAuthSession(user.id, user.roles);

    res.json({
      success: true,
      token: session.token,
      tokenType: 'Bearer',
      expiresAt: session.expiresAt,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        roles: user.roles,
        tenantId: user.tenant_id
      }
    });
  } catch (error) {
    next(error);
  }
});

toolsRouter.post('/auth/google', async (req, res, next) => {
  try {
    const { idToken, accessToken } = googleLoginSchema.parse(req.body);
    let email = '';
    let name = '';
    let sub = '';

    if (idToken) {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID || 'dummy',
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new AppError('UNAUTHENTICATED', 'Google ID token không hợp lệ.', 401);
      }
      email = payload.email;
      name = payload.name || payload.email;
      sub = payload.sub;
    } else if (accessToken) {
      const userInfoResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!userInfoResp.ok) {
        throw new AppError('UNAUTHENTICATED', 'Google access token không hợp lệ.', 401);
      }
      const userInfo = await userInfoResp.json();
      if (!userInfo.email) {
        throw new AppError('UNAUTHENTICATED', 'Tài khoản Google không có thông tin email.', 401);
      }
      email = userInfo.email;
      name = userInfo.name || userInfo.email;
      sub = userInfo.sub;
    } else {
      throw new AppError('INVALID_TOOL_INPUT', 'Cần truyền idToken hoặc accessToken.', 400);
    }

    // Find user by email
    const result = await query<LoginUserRow>(
      `
      SELECT
        u.id,
        u.username,
        u.password_hash,
        u.display_name,
        u.email,
        u.tenant_id,
        u.role,
        COALESCE(NULLIF(array_agg(r.role_code ORDER BY r.role_code) FILTER (WHERE r.role_code IS NOT NULL), '{}'), ARRAY[COALESCE(u.role, 'admin')]) AS roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.status = 'active'
        AND u.email = $1
      GROUP BY u.id, u.username, u.password_hash, u.display_name, u.email, u.tenant_id, u.role
      LIMIT 1
      `,
      [email]
    );

    let user = result.rows[0];
    if (!user) {
      const defaultTenantId = '00000000-0000-0000-0000-000000000000';
      const defaultRole = 'admin';
      const insertResult = await query<{id: string}>(
        `INSERT INTO users (username, display_name, email, sso_provider, sso_id, tenant_id, role)
         VALUES ($1, $2, $3, 'google', $4, $5, $6) RETURNING id`,
        [email, name || email, email, sub, defaultTenantId, defaultRole]
      );

      const newUserId = insertResult.rows[0]?.id as string;
      const roleResult = await query<{id: string}>(`SELECT id FROM roles WHERE role_code = $1 LIMIT 1`, [defaultRole]);
      if (roleResult.rows.length > 0 && roleResult.rows[0]) {
        await query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [newUserId, roleResult.rows[0].id]);
      }

      user = {
        id: newUserId,
        username: email,
        password_hash: '',
        display_name: name || email,
        email: email,
        roles: [defaultRole],
        tenant_id: defaultTenantId
      };
    } else {
      if (!user.sso_provider) {
        await query(`UPDATE users SET sso_provider = 'google', sso_id = $1 WHERE id = $2`, [sub, user.id]);
      }
      if (user.role) {
        user.roles = [user.role];
      }
    }

    const session = await createAuthSession(user.id, user.roles);

    res.json({
      success: true,
      token: session.token,
      tokenType: 'Bearer',
      expiresAt: session.expiresAt,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        roles: user.roles,
        tenantId: user.tenant_id
      }
    });
  } catch (error) {
    next(error);
  }
});

toolsRouter.get('/me', async (req, res, next) => {
  try {
    const user = await getCurrentUser(req);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

toolsRouter.get('/tools', async (req, res, next) => {
  try {
    const user = await getCurrentUser(req);
    const mcpToolsResult = await mcpClientManager.listTools();
    const allTools = mcpToolsResult.tools;
    const visibleTools = [];

    for (const tool of allTools) {
      const config = getToolConfig(tool.name);
      let isPermitted = await canExecuteTool(user.roles, tool.name);

      const serverName = mcpClientManager.toolToServerMap.get(tool.name);
      if (serverName && user.tenantId) {
        const activeRes = await query<{ is_active: boolean }>(
          `SELECT is_active FROM tenant_integrations WHERE tenant_id = $1 AND integration_code = $2`,
          [user.tenantId, serverName]
        );
        if (activeRes.rows.length > 0 && activeRes.rows[0]?.is_active === false) {
          isPermitted = false;
        }
      }

      visibleTools.push({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        riskLevel: config.riskLevel,
        readOnly: config.readOnly,
        requiresConfirmation: config.requiresConfirmation,
        inputSchema: tool.inputSchema,
        permitted: isPermitted
      });
    }

    res.json({ tools: visibleTools });
  } catch (error) {
    next(error);
  }
});

toolsRouter.post('/tools/call', async (req, res, next) => {
  const startedAt = Date.now();
  let parsed: z.infer<typeof callToolSchema> | null = null;

  try {
    const user = await getCurrentUser(req);
    parsed = callToolSchema.parse(req.body);

    const targetServerName = mcpClientManager.toolToServerMap.get(parsed.toolName);
    if (targetServerName && user.tenantId) {
      const activeRes = await query<{ is_active: boolean }>(
        `SELECT is_active FROM tenant_integrations WHERE tenant_id = $1 AND integration_code = $2`,
        [user.tenantId, targetServerName]
      );
      if (activeRes.rows.length > 0 && activeRes.rows[0]?.is_active === false) {
        throw new AppError('PERMISSION_DENIED', `Hệ thống tích hợp ${targetServerName.toUpperCase()} hiện đang bị TẮT trong Cấu hình Tích hợp. Vui lòng BẬT lại để sử dụng.`, 400);
      }
    }

    if (['get_customer_orders', 'get_revenue_summary', 'get_top_customers', 'get_product_sales_summary'].includes(parsed.toolName)) {
      const args = (parsed.arguments || {}) as any;
      if (!args.toDate) {
        args.toDate = new Date().toISOString();
      }
      if (!args.fromDate) {
        const d = new Date();
        d.setDate(d.getDate() - 90);
        args.fromDate = d.toISOString();
      }
      parsed.arguments = args;
    }

    if (!(await canExecuteTool(user.roles, parsed.toolName))) {
      throw new AppError('PERMISSION_DENIED', 'Ban khong co quyen goi tool nay.', 403);
    }

    await writeAuditLog({
      userId: user.id,
      sessionId: parsed.sessionId,
      toolName: parsed.toolName,
      input: parsed.arguments,
      output: null,
      status: 'request-start',
      errorMessage: null,
      durationMs: 0
    });

    const serverName = targetServerName; // Use targetServerName
    console.log(`[Tool Execution] toolName: ${parsed.toolName}, serverName: ${serverName}, tenantId: ${user?.tenantId}`);
    let mergedArgs = { ...((parsed.arguments as object) || {}) };

    if (serverName && user.tenantId) {
      const vaultPath = `integrations/${user.tenantId}/${serverName}`;
      let secrets: Record<string, any> | null = null;
      try {
        secrets = await VaultService.readSecret(vaultPath);
      } catch {
        secrets = null;
      }
      
      const dbRes = await query<{ api_url: string; api_key: string }>(
        `SELECT api_url, api_key FROM tenant_integrations WHERE tenant_id = $1 AND integration_code = $2`,
        [user.tenantId, serverName]
      );
      const dbApiUrl = dbRes.rows[0]?.api_url;
      const dbApiKey = dbRes.rows[0]?.api_key;

      const defaultUrls: Record<string, string> = {
        erpnext: 'https://eaa-enterprise-demo.s.frappe.cloud',
        zammad: 'http://host.docker.internal:8080',
        gitea: 'http://host.docker.internal:3001',
        n8n: 'http://host.docker.internal:5678'
      };

      const finalCredentials = {
        apiKey: secrets?.apiKey || dbApiKey || '',
        apiUrl: secrets?.apiUrl || dbApiUrl || defaultUrls[serverName] || ''
      };

      if ((!secrets || !secrets.apiKey) && dbApiKey) {
        try {
          await VaultService.writeSecret(vaultPath, {
            apiKey: dbApiKey,
            apiUrl: finalCredentials.apiUrl
          });
          console.log(`[Vault Auto-Recovery] Re-synced secret for ${vaultPath} into Vault from DB.`);
        } catch (vErr: any) {
          console.warn(`[Vault Auto-Recovery Warning]:`, vErr.message);
        }
      }

      mergedArgs = { ...mergedArgs, _integrationCredentials: finalCredentials };
    }
    console.log(`[Tool Execution] final mergedArgs:`, JSON.stringify(mergedArgs));

    const data = await mcpClientManager.callTool(parsed.toolName, mergedArgs);

    const durationMs = Date.now() - startedAt;

    await writeAuditLog({
      userId: user.id,
      sessionId: parsed.sessionId,
      toolName: parsed.toolName,
      input: parsed.arguments,
      output: data,
      status: 'success',
      errorMessage: null,
      durationMs
    });

    res.json({
      success: true,
      toolName: parsed.toolName,
      data,
      durationMs
    });
  } catch (error) {
    console.error('Real error in tools.ts:', error);
    const durationMs = Date.now() - startedAt;
    const appError =
      error instanceof AppError
        ? error
        : error instanceof z.ZodError
          ? new AppError('INVALID_TOOL_INPUT', error.issues[0]?.message ?? 'Invalid request body', 400)
          : new AppError('INTERNAL_ERROR', 'Internal server error', 500);

    try {
      const user = await getCurrentUser(req);
      await writeAuditLog({
        userId: user.id,
        sessionId: parsed?.sessionId ?? null,
        toolName: parsed?.toolName ?? null,
        input: parsed?.arguments ?? req.body,
        output: null,
        status: 'failed',
        errorMessage: appError.message,
        durationMs
      });
    } catch {
      // Do not hide the original API error if audit logging also fails.
    }

    next(appError);
  }
});

toolsRouter.get('/audit-logs', async (req, res, next) => {
  try {
    const user = await getCurrentUser(req);
    if (!(await canExecuteTool(user.roles, 'view_audit_logs'))) {
      throw new AppError('PERMISSION_DENIED', 'Chi admin duoc xem audit log.', 403);
    }

    const filters = auditLogQuerySchema.parse(req.query);
    const result = await query(
      `
      SELECT
        al.id,
        al.user_id,
        u.username,
        al.session_id,
        al.tool_name,
        al.input_json,
        al.output_json,
        al.status,
        al.error_message,
        al.duration_ms,
        al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE ($1::timestamptz IS NULL OR al.created_at >= $1::timestamptz)
        AND ($2::timestamptz IS NULL OR al.created_at < ($2::date + INTERVAL '1 day'))
        AND ($3::text IS NULL OR al.tool_name = $3)
        AND ($4::uuid IS NULL OR al.user_id = $4)
        AND ($5::text IS NULL OR al.status = $5)
      ORDER BY al.created_at DESC
      LIMIT 100
      `,
      [
        filters.fromDate ?? null,
        filters.toDate ?? null,
        filters.toolName ?? null,
        filters.userId ?? null,
        filters.status ?? null
      ]
    );

    res.json({ items: result.rows });
  } catch (error) {
    next(error);
  }
});
