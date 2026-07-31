import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { query, getCurrentUser, mcpClientManager } = vi.hoisted(() => ({
  query: vi.fn(),
  getCurrentUser: vi.fn(),
  mcpClientManager: {
    initialize: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn(),
    callTool: vi.fn(),
    toolToServerMap: new Map()
  }
}));

vi.mock('../db/pool.js', () => ({ query }));
vi.mock('../auth/current-user.js', () => ({ getCurrentUser }));
vi.mock('../connectors/mcp-client-manager.js', () => ({ mcpClientManager }));

import { createApp } from '../app.js';

describe('Tools & Login Routes Integration Suite (routes/tools.ts)', () => {
  const mockUser = {
    id: '10000000-0000-0000-0000-000000000001',
    username: 'admin',
    displayName: 'Quản trị viên',
    roles: ['admin'],
    tenantId: '00000000-0000-0000-0000-000000000000'
  };

  beforeEach(() => {
    query.mockReset();
    getCurrentUser.mockReset();
    mcpClientManager.listTools.mockReset();
    mcpClientManager.callTool.mockReset();
  });

  describe('POST /api/login', () => {
    it('rejects invalid credentials when user is not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const response = await request(createApp())
        .post('/api/login')
        .send({ username: 'nonexistent', password: 'wrongpassword' })
        .expect(401);

      expect(response.body.errorCode).toBe('UNAUTHENTICATED');
    });
  });

  describe('GET /api/tools', () => {
    it('returns permitted tools for authenticated admin user', async () => {
      getCurrentUser.mockResolvedValue(mockUser);
      mcpClientManager.listTools.mockResolvedValue({
        tools: [
          { name: 'search_customer', description: 'Find customer' },
          { name: 'get_revenue_summary', description: 'Revenue' }
        ]
      });

      const response = await request(createApp())
        .get('/api/tools')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.tools).toBeDefined();
      expect(Array.isArray(response.body.tools)).toBe(true);
      expect(response.body.tools).toHaveLength(2);
    });
  });
});
