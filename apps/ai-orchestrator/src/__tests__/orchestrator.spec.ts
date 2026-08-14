import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import * as chatHistoryRepo from '../repositories/chat-history-repository.js';
import { createApp } from '../app.js';
import { pool } from '../db/pool.js';

vi.spyOn(chatHistoryRepo, 'appendChatTurn').mockResolvedValue(undefined as any);
vi.spyOn(pool, 'query').mockResolvedValue({ rows: [] } as any);

const app = createApp();

describe('ai-orchestrator integration', () => {
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

  it('POST /api/chat with mock provider plans get_revenue_summary and returns answer', async () => {
    const mockUser = {
      id: '10000000-0000-0000-0000-000000000002',
      username: 'manager',
      displayName: 'Manager User',
      roles: ['manager']
    };

    const mockTools = [
      {
        name: 'get_revenue_summary',
        title: 'Get Revenue Summary',
        description: 'Summarize paid revenue by day, month or payment method.',
        inputSchema: { type: 'object' }
      }
    ];

    const mockToolCallResponse = {
      success: true,
      toolName: 'get_revenue_summary',
      data: {
        fromDate: '2026-07-09',
        toDate: '2026-07-09',
        totalRevenue: 25000000,
        totalOrders: 10,
        groups: []
      },
      durationMs: 45
    };

    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const mockHeaders = new Headers({ 'Content-Type': 'application/json' });
      if (url.endsWith('/api/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: mockHeaders,
          json: () => Promise.resolve({ user: mockUser })
        } as unknown as Response);
      }
      if (url.endsWith('/api/tools')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: mockHeaders,
          json: () => Promise.resolve({ tools: mockTools })
        } as unknown as Response);
      }
      if (url.endsWith('/api/tools/call')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: mockHeaders,
          json: () => Promise.resolve(mockToolCallResponse)
        } as unknown as Response);
      }
      if (url.endsWith('/chat/completions')) {
        const body = init?.body ? JSON.parse(init.body as string) : { messages: [] };
        const messages = body.messages || [];
        const isToolResponse = messages.length > 0 && messages[messages.length - 1].role === 'tool';
        
        if (!isToolResponse) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: mockHeaders,
            json: () => Promise.resolve({
              choices: [{
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [{
                    id: 'call_123',
                    type: 'function',
                    function: {
                      name: 'get_revenue_summary',
                      arguments: '{}'
                    }
                  }]
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
                  content: 'Doanh thu hôm nay là 25.000.000 VND với 10 đơn hàng.'
                }
              }]
            })
          } as unknown as Response);
        }
      }
      return Promise.reject(new Error(`Unhandled mock fetch for ${url}`));
    });

    const response = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer mock-token-abc')
      .send({
        sessionId: `test-session-${Date.now()}`,
        message: 'Hôm nay doanh thu bao nhiêu?'
      })
      .expect(200);

    expect(response.body).toHaveProperty('sessionId');
    expect(response.body).toHaveProperty('answer');
    expect(response.body.answer).toContain('25.000.000 VND');
    expect(response.body.answer).toContain('10 đơn hàng');
    expect(response.body.toolCalls).toHaveLength(1);
    expect(response.body.toolCalls[0]).toMatchObject({
      toolName: 'get_revenue_summary',
      success: true,
      data: {
        totalRevenue: 25000000,
        totalOrders: 10
      }
    });
  });
});
