import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/pool.js';
import { McpGatewayClient } from '../gateway/mcp-gateway-client.js';

const app = createApp();

describe('AI Orchestrator - Advanced Chat Service Tests', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('handles multi-round tool calling (round 1 -> round 2 -> final response)', async () => {
    const mockUser = {
      id: '10000000-0000-0000-0000-000000000002',
      username: 'manager',
      displayName: 'Manager User',
      roles: ['manager'],
      tenantId: '00000000-0000-0000-0000-000000000000'
    };

    const mockTools = [
      { name: 'search_customer', title: 'Search Customer', inputSchema: { type: 'object' } },
      { name: 'get_customer_orders', title: 'Get Customer Orders', inputSchema: { type: 'object' } }
    ];

    vi.spyOn(McpGatewayClient.prototype, 'getCurrentUser').mockResolvedValue(mockUser);
    vi.spyOn(McpGatewayClient.prototype, 'listTools').mockResolvedValue(mockTools);

    let toolCallCount = 0;
    vi.spyOn(McpGatewayClient.prototype, 'callTool').mockImplementation(async (toolName) => {
      toolCallCount++;
      if (toolName === 'search_customer') {
        return {
          success: true,
          toolName: 'search_customer',
          data: { customers: [{ customerId: 'c123', fullName: 'Nguyễn Văn A' }] },
          durationMs: 20
        };
      }
      return {
        success: true,
        toolName: 'get_customer_orders',
        data: { orders: [{ orderCode: 'DH001', status: 'completed', totalAmount: 1000000 }] },
        durationMs: 30
      };
    });

    let openaiCallCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      openaiCallCount++;
      const mockHeaders = new Headers({ 'Content-Type': 'application/json' });

      if (openaiCallCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: mockHeaders,
          json: () => Promise.resolve({
            choices: [{
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'search_customer', arguments: '{"keyword":"Nguyễn Văn A"}' } }]
              }
            }]
          })
        } as unknown as Response);
      } else if (openaiCallCount === 2) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: mockHeaders,
          json: () => Promise.resolve({
            choices: [{
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [{ id: 'call_2', type: 'function', function: { name: 'get_customer_orders', arguments: '{"customerId":"c123"}' } }]
              }
            }]
          })
        } as unknown as Response);
      } else {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: mockHeaders,
          json: () => Promise.resolve({
            choices: [{
              message: {
                role: 'assistant',
                content: 'Khách hàng Nguyễn Văn A có 1 đơn hàng DH001 hoàn tất.'
              }
            }]
          })
        } as unknown as Response);
      }
    });

    const response = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer mock-token')
      .send({ sessionId: `multi-round-${Date.now()}`, message: 'Tìm đơn hàng của khách hàng Nguyễn Văn A' })
      .expect(200);

    expect(response.body.answer).toContain('DH001');
    expect(response.body.toolCalls).toHaveLength(2);
    expect(toolCallCount).toBe(2);
  });

  it('safely handles tool error and returns friendly answer', async () => {
    const mockUser = {
      id: '10000000-0000-0000-0000-000000000003',
      username: 'staff',
      displayName: 'Staff User',
      roles: ['staff'],
      tenantId: '00000000-0000-0000-0000-000000000000'
    };

    vi.spyOn(McpGatewayClient.prototype, 'getCurrentUser').mockResolvedValue(mockUser);
    vi.spyOn(McpGatewayClient.prototype, 'listTools').mockResolvedValue([
      { name: 'get_order_detail', title: 'Get Order Detail', inputSchema: { type: 'object' } }
    ]);
    vi.spyOn(McpGatewayClient.prototype, 'callTool').mockResolvedValue({
      success: false,
      toolName: 'get_order_detail',
      errorCode: 'NOT_FOUND',
      message: 'Không tìm thấy đơn hàng DH999',
      durationMs: 15
    });

    let openaiCallCount = 0;
    global.fetch = vi.fn().mockImplementation((urlInput: any) => {
      openaiCallCount++;
      const url = typeof urlInput === 'string' ? urlInput : (urlInput?.url || String(urlInput));
      const mockHeaders = new Headers({ 'Content-Type': 'application/json' });

      if (url.endsWith('/chat/completions')) {
        if (openaiCallCount === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: mockHeaders,
            json: () => Promise.resolve({
              choices: [{
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [{ id: 'call_err', type: 'function', function: { name: 'get_order_detail', arguments: '{"orderCode":"DH999"}' } }]
                }
              }]
            })
          } as unknown as Response);
        } else {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: mockHeaders,
            json: () => Promise.resolve({
              choices: [{
                message: {
                  role: 'assistant',
                  content: 'Rất tiếc, không tìm thấy thông tin chi tiết đơn hàng DH999 trong hệ thống.'
                }
              }]
            })
          } as unknown as Response);
        }
      }

      return Promise.resolve({ ok: true, status: 200, headers: mockHeaders, json: () => Promise.resolve({}) } as unknown as Response);
    });

    const response = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer mock-token')
      .send({ sessionId: `error-test-${Date.now()}`, message: 'Chi tiết đơn DH999' })
      .expect(200);

    expect(response.body.answer).toContain('không tìm thấy');
    expect(response.body.toolCalls[0].success).toBe(false);
  });
});
