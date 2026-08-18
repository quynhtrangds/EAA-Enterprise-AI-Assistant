import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { query, createAuthSession } = vi.hoisted(() => ({
  query: vi.fn(),
  createAuthSession: vi.fn()
}));

vi.mock('../db/pool.js', () => ({ query }));

vi.mock('../auth/auth-sessions.js', () => ({
  createAuthSession,
  getUserByToken: vi.fn()
}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = vi.fn().mockResolvedValue({
      getPayload: () => ({
        email: 'unprovisioned@example.com',
        name: 'Unprovisioned User',
        sub: 'google-subject-123'
      })
    });
  }
}));

vi.mock('../config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 8081,
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    CORS_ORIGINS: 'http://localhost:3000',
    TOOL_TIMEOUT_MS: 10000
  }
}));

import { createApp } from '../app.js';

describe('Google authentication', () => {
  beforeEach(() => {
    query.mockReset();
    createAuthSession.mockReset();
  });

  it('rejects a valid Google account that has not been provisioned', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const response = await request(createApp())
      .post('/api/auth/google')
      .send({ idToken: 'valid-google-id-token' })
      .expect(403);

    expect(response.body).toMatchObject({
      success: false,
      errorCode: 'UNAUTHORIZED'
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('email trùng ở 2 tenant, chưa ai bind sso_id – từ chối vì mơ hồ, không chọn bừa', async () => {
    const candidateA = {
      id: 'user-a', username: 'shared', password_hash: null,
      display_name: 'A', email: 'unprovisioned@example.com', tenant_id: 'tenant-a',
      role: 'staff', sso_provider: null, sso_id: null, roles: ['staff']
    };
    const candidateB = {
      id: 'user-b', username: 'shared', password_hash: null,
      display_name: 'B', email: 'unprovisioned@example.com', tenant_id: 'tenant-b',
      role: 'staff', sso_provider: null, sso_id: null, roles: ['staff']
    };
    query.mockResolvedValueOnce({ rows: [candidateA, candidateB] });

    const response = await request(createApp())
      .post('/api/auth/google')
      .send({ idToken: 'valid-google-id-token' })
      .expect(403);

    expect(response.body.errorCode).toBe('UNAUTHORIZED');
    expect(createAuthSession).not.toHaveBeenCalled();
  });

  it('email trùng ở 2 tenant nhưng 1 candidate đã bind đúng sso_id – đăng nhập đúng candidate đó', async () => {
    const candidateA = {
      id: 'user-a', username: 'shared', password_hash: null,
      display_name: 'A', email: 'unprovisioned@example.com', tenant_id: 'tenant-a',
      role: 'staff', sso_provider: 'google', sso_id: 'google-subject-123', roles: ['staff']
    };
    const candidateB = {
      id: 'user-b', username: 'shared', password_hash: null,
      display_name: 'B', email: 'unprovisioned@example.com', tenant_id: 'tenant-b',
      role: 'staff', sso_provider: null, sso_id: null, roles: ['staff']
    };
    query.mockResolvedValueOnce({ rows: [candidateB, candidateA] }); // cố tình để candidate đúng KHÔNG đứng đầu
    createAuthSession.mockResolvedValueOnce({ token: 'tok', expiresAt: '2026-08-02T00:00:00Z' });

    const response = await request(createApp())
      .post('/api/auth/google')
      .send({ idToken: 'valid-google-id-token' })
      .expect(200);

    expect(createAuthSession).toHaveBeenCalledWith('user-a', ['staff']);
    expect(response.body.user.username).toBe('shared');
  });

  it('issues a server-generated session for guest access', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        id: '10000000-0000-0000-0000-000000000004',
        tenant_id: '00000000-0000-0000-0000-000000000000'
      }]
    });
    createAuthSession.mockResolvedValueOnce({
      token: 'server-generated-token',
      expiresAt: '2026-08-01T00:00:00.000Z'
    });

    const response = await request(createApp())
      .post('/api/auth/guest')
      .expect(200);

    expect(createAuthSession).toHaveBeenCalledWith(
      '10000000-0000-0000-0000-000000000004',
      ['viewer']
    );
    expect(response.body).toMatchObject({
      token: 'server-generated-token',
      user: { username: 'guest', roles: ['viewer'] }
    });
  });
});