import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import request from 'supertest';

// QUAN TRỌNG: phải set LLM_PROVIDER=mock TRƯỚC khi import bất kỳ module nội
// bộ nào — config/env.ts parse process.env một lần duy nhất lúc module được
// load (xem giải thích tương tự trong chat-service-advanced.spec.ts).
process.env.LLM_PROVIDER = 'mock';

const { createApp } = await import('../app.js');
const { pool } = await import('../db/pool.js');
const { McpGatewayClient } = await import('../gateway/mcp-gateway-client.js');

const app = createApp();

const MOCK_USER_ID = '10000000-0000-0000-0000-000000000002';
const MOCK_TENANT_ID = '00000000-0000-0000-0000-000000000000';

function mockDbForSession() {
  vi.spyOn(pool, 'query').mockImplementation(async (text: string) => {
    if (text.includes('SELECT user_id, tenant_id') && text.includes('chat_sessions')) {
      return {
        rows: [{ user_id: MOCK_USER_ID, tenant_id: MOCK_TENANT_ID }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      } as any;
    }
    return { rows: [], command: '', rowCount: 0, oid: 0, fields: [] } as any;
  });
}

describe('AI Orchestrator - chatWithMock (LLM_PROVIDER=mock)', () => {
  beforeEach(() => {
    mockDbForSession();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('tra cứu customerId qua search_customer trước khi gọi get_customer_orders (không gửi thẳng customerName — field này không tồn tại trong input schema thật của get_customer_orders)', async () => {
    const mockUser = {
      id: MOCK_USER_ID,
      username: 'admin',
      displayName: 'Admin User',
      roles: ['admin'],
      tenantId: MOCK_TENANT_ID
    };

    vi.spyOn(McpGatewayClient.prototype, 'getCurrentUser').mockResolvedValue(mockUser);
    vi.spyOn(McpGatewayClient.prototype, 'listTools').mockResolvedValue([]);
    vi.spyOn(McpGatewayClient.prototype, 'disconnect').mockResolvedValue(undefined);

    const callToolSpy = vi.spyOn(McpGatewayClient.prototype, 'callTool').mockImplementation(
      async (_authToken: string, _sessionId: string, toolName: string, _args: Record<string, unknown>) => {
        if (toolName === 'search_customer') {
          return {
            success: true,
            toolName,
            data: {
              customers: [
                {
                  customerId: '20000000-0000-0000-0000-000000000001',
                  customerCode: 'CUS-001',
                  fullName: 'Nguyễn Văn A',
                  phone: '0901000001',
                  email: 'nguyenvana@example.com',
                  address: 'Quận 1, TP. HCM',
                  status: 'active'
                }
              ]
            },
            durationMs: 5
          };
        }
        if (toolName === 'get_customer_orders') {
          return { success: true, toolName, data: { orders: [] }, durationMs: 5 };
        }
        throw new Error(`Unexpected tool call: ${toolName}`);
      }
    );

    const response = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer fake-token')
      .send({ sessionId: 'session-mock-test', message: 'Khách hàng Nguyễn Văn A có những đơn hàng nào?' })
      .expect(200);

    // Phải gọi search_customer TRƯỚC, rồi mới gọi get_customer_orders
    expect(callToolSpy).toHaveBeenCalledTimes(2);
    expect(callToolSpy.mock.calls[0][2]).toBe('search_customer');
    expect(callToolSpy.mock.calls[1][2]).toBe('get_customer_orders');

    // get_customer_orders PHẢI được gọi với customerId (UUID) lấy từ kết quả
    // search_customer — KHÔNG được gửi customerName (field không tồn tại
    // trong input schema thật của tool này, xem packages/mcp-server-postgres).
    const secondCallArgs = callToolSpy.mock.calls[1][3] as Record<string, unknown>;
    expect(secondCallArgs.customerId).toBe('20000000-0000-0000-0000-000000000001');
    expect(secondCallArgs).not.toHaveProperty('customerName');

    expect(response.body.answer).toContain('đơn hàng');
  });

  it('trả lời rõ ràng khi không tìm thấy khách hàng qua search_customer', async () => {
    const mockUser = {
      id: MOCK_USER_ID,
      username: 'admin',
      displayName: 'Admin User',
      roles: ['admin'],
      tenantId: MOCK_TENANT_ID
    };

    vi.spyOn(McpGatewayClient.prototype, 'getCurrentUser').mockResolvedValue(mockUser);
    vi.spyOn(McpGatewayClient.prototype, 'listTools').mockResolvedValue([]);
    vi.spyOn(McpGatewayClient.prototype, 'disconnect').mockResolvedValue(undefined);

    const callToolSpy = vi.spyOn(McpGatewayClient.prototype, 'callTool').mockResolvedValue({
      success: true,
      toolName: 'search_customer',
      data: { customers: [] },
      durationMs: 5
    });

    const response = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer fake-token')
      .send({ sessionId: 'session-mock-test-2', message: 'Khách hàng Nguyễn Văn A có những đơn hàng nào?' })
      .expect(200);

    // Không tìm thấy khách hàng -> KHÔNG được gọi tiếp get_customer_orders
    expect(callToolSpy).toHaveBeenCalledTimes(1);
    expect(response.body.answer).toContain('Không tìm thấy khách hàng');
  });
});
