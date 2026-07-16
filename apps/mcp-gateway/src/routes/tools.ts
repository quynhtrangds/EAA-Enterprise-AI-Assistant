import { Router } from 'express';
import { z } from 'zod';
import { writeAuditLog } from '../audit/audit-log.js';
import { createAuthSession } from '../auth/auth-sessions.js';
import { createToolContext, getCurrentUser } from '../auth/current-user.js';
import { query } from '../db/pool.js';
import { AppError } from '../errors/app-error.js';
import { canExecuteTool } from '../policies/tool-permissions.js';
import { getToolConfig } from '../config/tools-config.js';
import { postgresMcpClient } from '../connectors/postgres-mcp-client.js';

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
  roles: string[];
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
        COALESCE(array_agg(r.role_code ORDER BY r.role_code) FILTER (WHERE r.role_code IS NOT NULL), '{}') AS roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.status = 'active'
        AND u.username = $1
      GROUP BY u.id, u.username, u.password_hash, u.display_name, u.email
      LIMIT 1
      `,
      [credentials.username]
    );

    const user = result.rows[0];
    if (!user || user.password_hash !== credentials.password) {
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
        roles: user.roles
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
    const mcpToolsResult = await postgresMcpClient.listTools();
    const allTools = mcpToolsResult.tools;
    const visibleTools = [];

    for (const tool of allTools) {
      const config = getToolConfig(tool.name);
      const isPermitted = await canExecuteTool(user.roles, tool.name);
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

    if (parsed.toolName === 'get_customer_orders') {
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

    const data = await postgresMcpClient.callTool(parsed.toolName, parsed.arguments);

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
