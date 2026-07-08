import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { pool, query } from '../db/pool.js';

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
});
