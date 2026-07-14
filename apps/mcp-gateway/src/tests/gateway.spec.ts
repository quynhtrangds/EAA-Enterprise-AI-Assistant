import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { pool, query } from '../db/pool.js';
import { runtime } from '../runtime/runtime-instance.js';
import { z } from 'zod';

const app = createApp();

async function login(username: string, password: string): Promise<string> {
  const response = await request(app)
    .post('/api/login')
    .send({ username, password })
    .expect(200)
    .expect('Content-Type', /json/);

  expect(response.body).toMatchObject({
    success: true,
    tokenType: 'Bearer',
    user: { username }
  });
  expect(typeof response.body.token).toBe('string');
  expect(response.body.token.length).toBeGreaterThan(20);

  return response.body.token;
}

describe('mcp-gateway integration', () => {
  afterAll(async () => {
    await pool.end();
  });

  it('GET /health returns status 200 and valid JSON', async () => {
    const response = await request(app).get('/health').expect(200).expect('Content-Type', /json/);

    expect(response.body).toEqual({
      status: 'ok',
      service: 'mcp-gateway'
    });
  });

  it('POST /api/login returns a bearer token for valid credentials', async () => {
    const token = await login('manager', 'manager123');

    const sessionResult = await query<{ token: string; username: string; roles: string[] }>(
      `
      SELECT s.token, u.username, s.roles
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = $1
      LIMIT 1
      `,
      [token]
    );

    expect(sessionResult.rowCount).toBe(1);
    expect(sessionResult.rows[0]).toMatchObject({
      token,
      username: 'manager',
      roles: ['manager']
    });
  });

  it('POST /api/login rejects invalid credentials', async () => {
    const response = await request(app)
      .post('/api/login')
      .send({ username: 'manager', password: 'wrong-password' })
      .expect(401)
      .expect('Content-Type', /json/);

    expect(response.body).toMatchObject({
      success: false,
      errorCode: 'UNAUTHENTICATED'
    });
  });

  it('POST /api/tools/call rejects search_customer when limit exceeds max', async () => {
    const token = await login('manager', 'manager123');
    const response = await request(app)
      .post('/api/tools/call')
      .set('Authorization', `Bearer ${token}`)
      .send({
        toolName: 'search_customer',
        arguments: {
          keyword: 'Nguyen',
          limit: 999
        },
        sessionId: `test-invalid-limit-${Date.now()}`
      })
      .expect(400)
      .expect('Content-Type', /json/);

    expect(response.body).toMatchObject({
      success: false,
      errorCode: 'INVALID_TOOL_INPUT'
    });
  });

  it('POST /api/tools/call denies viewer access to search_customer and writes audit log', async () => {
    const sessionId = `test-permission-denied-${Date.now()}`;
    const token = await login('viewer', 'viewer123');

    const response = await request(app)
      .post('/api/tools/call')
      .set('Authorization', `Bearer ${token}`)
      .send({
        toolName: 'search_customer',
        arguments: {
          keyword: 'Nguyen',
          limit: 5
        },
        sessionId
      })
      .expect(403)
      .expect('Content-Type', /json/);

    expect(response.body).toMatchObject({
      success: false,
      errorCode: 'PERMISSION_DENIED'
    });

    const auditResult = await query<{
      session_id: string;
      tool_name: string;
      status: string;
      error_message: string | null;
    }>(
      `
      SELECT session_id, tool_name, status, error_message
      FROM audit_logs
      WHERE session_id = $1
        AND tool_name = 'search_customer'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [sessionId]
    );

    expect(auditResult.rowCount).toBe(1);
    expect(auditResult.rows[0]).toMatchObject({
      session_id: sessionId,
      tool_name: 'search_customer',
      status: 'failed',
      error_message: 'Ban khong co quyen goi tool nay.'
    });
  });

  it('GET /api/tools filters tools based on role', async () => {
    const viewerToken = await login('viewer', 'viewer123');
    const viewerResponse = await request(app)
      .get('/api/tools')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    const viewerTools = viewerResponse.body.tools.map((t: any) => t.name);
    expect(viewerTools).toContain('get_revenue_summary');
    expect(viewerTools).toContain('get_product_sales_summary');
    expect(viewerTools).not.toContain('search_customer');

    const staffToken = await login('staff', 'staff123');
    const staffResponse = await request(app)
      .get('/api/tools')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    const staffTools = staffResponse.body.tools.map((t: any) => t.name);
    expect(staffTools).toContain('search_customer');
    expect(staffTools).toContain('get_customer_orders');
    expect(staffTools).toContain('get_order_detail');
    expect(staffTools).not.toContain('get_revenue_summary');
  });

  it('GET /api/audit-logs allows admin but denies manager access', async () => {
    const adminToken = await login('admin', 'admin123');
    const adminResponse = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(adminResponse.body.items)).toBe(true);

    const managerToken = await login('manager', 'manager123');
    const managerResponse = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(403);

    expect(managerResponse.body.success).toBe(false);
    expect(managerResponse.body.errorCode).toBe('PERMISSION_DENIED');
  });

  it('POST /api/tools/call happy path for search_customer', async () => {
    const token = await login('manager', 'manager123');
    const response = await request(app)
      .post('/api/tools/call')
      .set('Authorization', `Bearer ${token}`)
      .send({
        toolName: 'search_customer',
        arguments: {
          keyword: 'Nguyen',
          limit: 2
        },
        sessionId: `test-search-${Date.now()}`
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.toolName).toBe('search_customer');
    expect(response.body.data).toHaveProperty('customers');
    expect(Array.isArray(response.body.data.customers)).toBe(true);
    expect(response.body.data.customers.length).toBeGreaterThan(0);
    expect(response.body.data.customers[0]).toHaveProperty('customerId');
    expect(response.body.data.customers[0]).toHaveProperty('customerCode');
    expect(response.body.data.customers[0]).toHaveProperty('fullName');
  });

  it('POST /api/tools/call happy path for get_order_detail with nested items/payments', async () => {
    const token = await login('manager', 'manager123');
    
    const response = await request(app)
      .post('/api/tools/call')
      .set('Authorization', `Bearer ${token}`)
      .send({
        toolName: 'get_order_detail',
        arguments: {
          orderCode: 'ORD-001'
        },
        sessionId: `test-order-detail-${Date.now()}`
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.toolName).toBe('get_order_detail');
    expect(response.body.data).toHaveProperty('order');
    const orderObj = response.body.data.order;
    expect(orderObj).toHaveProperty('orderId');
    expect(orderObj).toHaveProperty('orderCode', 'ORD-001');
    expect(orderObj).toHaveProperty('items');
    expect(Array.isArray(orderObj.items)).toBe(true);
    expect(orderObj).toHaveProperty('payments');
    expect(Array.isArray(orderObj.payments)).toBe(true);
  });

  it('POST /api/tools/call happy path for get_revenue_summary', async () => {
    const token = await login('manager', 'manager123');
    const response = await request(app)
      .post('/api/tools/call')
      .set('Authorization', `Bearer ${token}`)
      .send({
        toolName: 'get_revenue_summary',
        arguments: {
          fromDate: '2026-01-01',
          toDate: '2026-12-31',
          groupBy: 'day'
        },
        sessionId: `test-revenue-${Date.now()}`
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.toolName).toBe('get_revenue_summary');
    expect(response.body.data).toHaveProperty('fromDate');
    expect(response.body.data).toHaveProperty('toDate');
    expect(response.body.data).toHaveProperty('totalRevenue');
    expect(response.body.data).toHaveProperty('totalOrders');
    expect(response.body.data).toHaveProperty('groups');
    expect(Array.isArray(response.body.data.groups)).toBe(true);
  });

  it('POST /api/tools/call returns TOOL_TIMEOUT when tool execution takes too long', async () => {
    runtime.registerConnector({
      name: 'mock_test_connector',
      listTools() {
        return [
          {
            name: 'slow_test_tool',
            title: 'Slow Test Tool',
            description: 'Runs slowly to trigger timeout',
            inputSchema: z.object({}),
            outputSchema: z.object({ ok: z.boolean() }),
            async execute() {
              await new Promise((resolve) => setTimeout(resolve, 300));
              return { ok: true };
            }
          }
        ];
      }
    });

    // Add permissions for slow_test_tool in database
    await query(
      `INSERT INTO tool_permissions (role_code, tool_name, can_execute)
       VALUES ('manager', 'slow_test_tool', true)
       ON CONFLICT (role_code, tool_name) DO UPDATE SET can_execute = true`
    );

    const token = await login('manager', 'manager123');
    
    // Set short timeout env variable
    process.env.TEST_TOOL_TIMEOUT_MS = '50';

    try {
      const response = await request(app)
        .post('/api/tools/call')
        .set('Authorization', `Bearer ${token}`)
        .send({
          toolName: 'slow_test_tool',
          arguments: {},
          sessionId: `test-timeout-${Date.now()}`
        })
        .expect(504);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'TOOL_TIMEOUT'
      });
    } finally {
      delete process.env.TEST_TOOL_TIMEOUT_MS;
      await query(`DELETE FROM tool_permissions WHERE tool_name = 'slow_test_tool'`);
    }
  });
});
