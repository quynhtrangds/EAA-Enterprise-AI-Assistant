import { Router } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { AppError } from '../errors/app-error.js';
import { getCurrentUser } from '../auth/current-user.js';
import { canExecuteTool } from '../policies/tool-permissions.js';
import { mcpClientManager } from '../connectors/mcp-client-manager.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { checkToolRateLimit } from '../policies/rate-limiter.js';

import { VaultService } from '../services/vault.js';
import { query } from '../db/pool.js';
import type { CurrentUser } from '../auth/current-user.js';

export const mcpRouter = Router();

// Ensure the client connects when the module loads
mcpClientManager.initialize().catch(console.error);

// To support multiple clients connecting to the SSE endpoint, we map sessionId -> Transport
const transports = new Map<string, SSEServerTransport>();
// Map sessionId -> CurrentUser for rate limiting and integration credentials
const sessionUsers = new Map<string, CurrentUser>();

// The MCP Server instance representing the Gateway
const mcpServer = new Server({
  name: 'mcp-gateway',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Implement the tools handler
mcpServer.setRequestHandler(ListToolsRequestSchema, async (request, extra) => {
  const result = await mcpClientManager.listTools();
  const sessionId = extra.sessionId;
  const user = sessionId ? sessionUsers.get(sessionId) : null;
  if (!user) {
    return { tools: result.tools };
  }

  const permittedTools = [];
  for (const tool of result.tools) {
    if (await canExecuteTool(user.roles, tool.name)) {
      permittedTools.push(tool);
    }
  }

  return {
    tools: permittedTools
  };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const toolName = request.params.name;
  const args = request.params.arguments || {};
  const sessionId = extra.sessionId;
  const user = sessionId ? sessionUsers.get(sessionId) : null;

  try {
    const data = await mcpClientManager.callTool(toolName, args, user?.roles || []);
    return data;
  } catch (error: any) {
    return {
      content: [
        { type: "text", text: `Error: ${error.message}` }
      ],
      isError: true
    };
  }
});

interface McpJsonRpcRequest {
  method?: string;
  params?: {
    name?: string;
    arguments?: unknown;
  };
}

/**
 * Kiểm tra quyền thực thi tool + rate limit + inject credential tích hợp
 * (Vault/DB) cho MỘT request JSON-RPC "tools/call". Được tách ra khỏi route
 * handler /mcp/message để có thể unit-test trực tiếp mà không cần dựng một
 * kết nối SSE thật (vốn rất khó mô phỏng trong test).
 *
 * Ném AppError nếu bị từ chối quyền hoặc tích hợp đang tắt. Nếu request
 * không phải 'tools/call' (vd 'tools/list'), hàm không làm gì cả.
 * Mutate trực tiếp `request.params.arguments` để gắn `_integrationCredentials`
 * khi tool thuộc 1 server có cấu hình tích hợp (giữ đúng hành vi cũ).
 */
export async function authorizeAndPrepareToolRequest(
  user: CurrentUser,
  request: McpJsonRpcRequest
): Promise<void> {
  if (request.method !== 'tools/call' || !request.params?.name) {
    return;
  }

  const toolName = request.params.name;
  if (!(await canExecuteTool(user.roles, toolName))) {
    throw new AppError('PERMISSION_DENIED', `Bạn không có quyền thực thi công cụ '${toolName}'.`, 403);
  }

  checkToolRateLimit(user.id, toolName);

  const serverName = mcpClientManager.toolToServerMap.get(toolName);
  if (!serverName || !user.tenantId) {
    return;
  }

  // Check if integration is active in DB
  const activeRes = await query<{ is_active: boolean }>(
    `SELECT is_active FROM tenant_integrations WHERE tenant_id = $1 AND integration_code = $2`,
    [user.tenantId, serverName]
  );
  if (activeRes.rows.length > 0 && activeRes.rows[0]?.is_active === false) {
    throw new AppError('PERMISSION_DENIED', `Hệ thống tích hợp ${serverName.toUpperCase()} hiện đang bị TẮT trong Cấu hình Tích hợp. Vui lòng BẬT lại để sử dụng.`, 400);
  }

  const vaultPath = `integrations/${user.tenantId}/${serverName}`;
  let secrets = await VaultService.readSecret(vaultPath);

  // Fallback to PostgreSQL DB if Vault lost memory or has no apiUrl
  if (!secrets || !secrets.apiUrl) {
    const dbRes = await query<{ api_url: string }>(
      `SELECT api_url FROM tenant_integrations WHERE tenant_id = $1 AND integration_code = $2 AND is_active = true`,
      [user.tenantId, serverName]
    );
    if (dbRes.rows[0]?.api_url) {
      secrets = { ...(secrets || {}), apiUrl: dbRes.rows[0].api_url };
    }
  }

  if (secrets && (secrets.apiKey || secrets.apiUrl)) {
    request.params.arguments = {
      ...((request.params.arguments as object) || {}),
      _integrationCredentials: secrets
    };
  }
}

mcpRouter.get('/mcp/sse', async (req, res, next) => {
  try {
    const user = await getCurrentUser(req);
    // Setup SSE transport
    const transport = new SSEServerTransport('/api/mcp/message', res);
    await mcpServer.connect(transport);
    
    // transport.sessionId is generated by SSEServerTransport
    transports.set(transport.sessionId, transport);
    sessionUsers.set(transport.sessionId, user);
    
    // Handle disconnect
    req.on('close', () => {
      transports.delete(transport.sessionId);
      sessionUsers.delete(transport.sessionId);
    });
  } catch (error) {
    next(error);
  }
});

mcpRouter.post('/mcp/message', async (req, res, next) => {
  try {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      throw new AppError('INVALID_TOOL_INPUT', 'Missing sessionId', 400);
    }
    const transport = transports.get(sessionId);
    if (!transport) {
      throw new AppError('TOOL_NOT_FOUND', 'Session not found or disconnected', 404);
    }
    
    const user = sessionUsers.get(sessionId);
    if (user && req.body) {
      // req.body can be a single request or an array of requests
      const requests = Array.isArray(req.body) ? req.body : [req.body];
      for (const r of requests) {
        await authorizeAndPrepareToolRequest(user, r);
      }
    }
    
    await transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    next(error);
  }
});
