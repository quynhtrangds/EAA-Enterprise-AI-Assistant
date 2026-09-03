import { Router } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { AppError } from '../errors/app-error.js';
import { getCurrentUser } from '../auth/current-user.js';
import { canExecuteTool } from '../policies/tool-permissions.js';
import { mcpClientManager } from '../connectors/mcp-client-manager.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { checkToolRateLimit } from '../policies/rate-limiter.js';
import { writeAuditLog } from '../audit/audit-log.js';

import { VaultService } from '../services/vault.js';
import { validateIntegrationUrl, validateIntegrationUrlAsync } from '../policies/url-validator.js';
import { query } from '../db/pool.js';
import { getActiveIntegrationCodes, isSupersededDemoTool } from '../config/demo-tools.js';
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

/**
 * Gán mặc định 90 ngày (fromDate / toDate) tập trung cho các công cụ doanh thu & bán hàng.
 */
export function applySalesDateDefaults(toolName: string, args: Record<string, any> = {}): Record<string, any> {
  if (['get_customer_orders', 'get_revenue_summary', 'get_top_customers', 'get_product_sales_summary'].includes(toolName)) {
    if (!args.toDate) {
      args.toDate = new Date().toISOString();
    }
    if (!args.fromDate) {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      args.fromDate = d.toISOString();
    }
  }
  return args;
}

/**
 * Hàm chuẩn bị & kiểm tra quyền tập trung cho MỌI lời gọi tool:
 * 1. Kiểm tra phân quyền RBAC (canExecuteTool)
 * 2. Kiểm tra Rate Limiting (checkToolRateLimit)
 * 3. Gán khoảng thời gian mặc định 90 ngày (applySalesDateDefaults)
 * 4. Inject _tenantId từ thông tin phiên người dùng
 * 5. Inject thông tin xác thực _integrationCredentials từ HashiCorp Vault (nếu có cấu hình)
 */
export async function prepareToolExecution(
  user: CurrentUser,
  toolName: string,
  rawArgs: Record<string, any> = {}
): Promise<Record<string, any>> {
  const args = { ...rawArgs };

  // 1. Phân quyền RBAC
  if (!(await canExecuteTool(user.roles, toolName))) {
    await writeAuditLog({
      userId: user.id,
      sessionId: null,
      toolName,
      input: rawArgs,
      output: null,
      status: 'failed',
      errorMessage: `Bạn không có quyền thực thi công cụ '${toolName}'.`,
      durationMs: 0
    }).catch(console.error);
    throw new AppError('PERMISSION_DENIED', `Bạn không có quyền thực thi công cụ '${toolName}'.`, 403);
  }

  // 2. Rate Limiter
  checkToolRateLimit(user.id, toolName);

  // 3. Default date window
  applySalesDateDefaults(toolName, args);

  // 4. Inject _tenantId
  if (user.tenantId) {
    args._tenantId = user.tenantId;
  }

  // 5. Chọn chế độ dữ liệu theo trạng thái tích hợp của tenant:
  //    - BẬT + đủ credentials trong Vault → inject _integrationCredentials (data thật)
  //    - TẮT / chưa khai báo / chưa đủ credentials → _mockMode: true (MCP server
  //      trả dữ liệu mẫu kèm nhãn _mock để báo người dùng đây không phải data thật).
  //      Server không hỗ trợ mock sẽ tự báo lỗi "chưa cấu hình" như trước.
  const serverName = mcpClientManager.toolToServerMap.get(toolName);
  if (serverName && user.tenantId) {
    const activeRes = await query<{ is_active: boolean }>(
      `SELECT is_active FROM tenant_integrations WHERE tenant_id = $1 AND integration_code = $2`,
      [user.tenantId, serverName]
    );

    const isActive = activeRes.rows.length > 0 && activeRes.rows[0]?.is_active === true;

    if (isActive) {
      const vaultPath = `integrations/${user.tenantId}/${serverName}`;
      const secrets = await VaultService.readSecret(vaultPath);
      if (secrets?.apiKey && secrets.apiUrl) {
        await validateIntegrationUrlAsync(secrets.apiUrl);

        args._integrationCredentials = { apiKey: secrets.apiKey, apiUrl: secrets.apiUrl };
        return args;
      }
    }

    args._mockMode = true;
  }

  return args;
}

// Implement the tools handler
mcpServer.setRequestHandler(ListToolsRequestSchema, async (request, extra) => {
  const result = await mcpClientManager.listTools();
  const sessionId = extra.sessionId;
  const user = sessionId ? sessionUsers.get(sessionId) : null;
  if (!user) {
    return { tools: result.tools };
  }

  const permittedTools = [];
  // Ẩn tool demo đã bị tích hợp thật thay thế (vd: CRM bật thì ẩn search_customer
  // đọc DB demo) — để mỗi miền dữ liệu chỉ còn một nguồn trả lời cho AI
  const activeCodes = user.tenantId ? await getActiveIntegrationCodes(user.tenantId) : new Set<string>();
  for (const tool of result.tools) {
    if (await canExecuteTool(user.roles, tool.name) && !isSupersededDemoTool(tool.name, activeCodes, user.roles)) {
      permittedTools.push(tool);
    }
  }

  return {
    tools: permittedTools
  };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const toolName = request.params.name;
  let args = (request.params.arguments || {}) as Record<string, any>;

  const sessionId = extra.sessionId;
  const user = sessionId ? sessionUsers.get(sessionId) : null;
  const startedAt = Date.now();

  try {
    if (user) {
      // Permission check + Rate limit + Date window + TenantId + Vault credentials
      args = await prepareToolExecution(user, toolName, args);
      request.params.arguments = args;
    } else {
      applySalesDateDefaults(toolName, args);
      request.params.arguments = args;
    }

    const data = await mcpClientManager.callTool(toolName, args, user?.roles || []);

    if (user) {
      await writeAuditLog({
        userId: user.id,
        sessionId: sessionId || null,
        toolName,
        input: args,
        output: data,
        status: 'success',
        errorMessage: null,
        durationMs: Date.now() - startedAt
      }).catch(console.error);
    }

    return data;
  } catch (error: any) {
    if (user) {
      await writeAuditLog({
        userId: user.id,
        sessionId: sessionId || null,
        toolName,
        input: args,
        output: null,
        status: 'failed',
        errorMessage: error.message,
        durationMs: Date.now() - startedAt
      }).catch(console.error);
    }

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
 * (Vault/DB) cho MỘT request JSON-RPC "tools/call" — logic thực chất chỉ là
 * gọi lại prepareToolExecution().
 *
 * LƯU Ý: hàm này KHÔNG còn được gọi từ route /mcp/message trong luồng thực tế
 * (xem comment tại route đó) — CallToolRequestSchema handler ở trên đã tự đủ
 * để bảo vệ mọi tool call. Hàm được giữ lại (export) chỉ để
 * mcp-authorize.test.ts có thể test logic authorize như 1 đơn vị độc lập, mà
 * không cần dựng một kết nối SSE thật (rất khó mô phỏng trong test). Không
 * xóa hàm này chỉ vì nó "không còn ai gọi" trong app code — nó vẫn có giá trị
 * cho test.
 */
export async function authorizeAndPrepareToolRequest(
  user: CurrentUser,
  request: McpJsonRpcRequest
): Promise<void> {
  if (request.method !== 'tools/call' || !request.params?.name) {
    return;
  }

  const toolName = request.params.name;
  const rawArgs = (request.params.arguments || {}) as Record<string, any>;
  const preparedArgs = await prepareToolExecution(user, toolName, rawArgs);
  request.params.arguments = preparedArgs;
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

    // KHÔNG gọi authorizeAndPrepareToolRequest() ở đây nữa. Trước đây route
    // này gọi nó rồi mới gọi transport.handlePostMessage() bên dưới — nhưng
    // handlePostMessage() lại kích hoạt CallToolRequestSchema handler ở
    // trên, và handler đó tự gọi prepareToolExecution() lần nữa. Kết quả là
    // permission/rate-limit/Vault bị kiểm tra 2 LẦN cho cùng 1 tool call:
    // checkToolRateLimit() trừ 2 "credit" thay vì 1 (hạn mức 20/phút thực
    // chất chỉ dùng được 10 lần), và mỗi tool có tích hợp Vault tốn thêm 1
    // round-trip Vault không cần thiết — rủi ro fail nếu Vault chậm/lag ở
    // lần gọi thứ 2 dù lần 1 đã qua. CallToolRequestSchema handler tự đủ để
    // bảo vệ mọi tool call đi qua nó, không cần lớp gọi trước ở route này.
    await transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    next(error);
  }
});