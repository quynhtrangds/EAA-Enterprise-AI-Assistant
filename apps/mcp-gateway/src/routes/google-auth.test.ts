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
