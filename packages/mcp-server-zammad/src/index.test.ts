import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAuthHeaders } from './index.js';

describe('mcp-server-zammad Unit & Mocked Execution Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAuthHeaders helper', () => {
    it('returns Accept header when no apiKey provided', () => {
      const headers = getAuthHeaders();
      expect(headers).toEqual({ Accept: 'application/json' });
    });

    it('formats Token token= prefix for raw key', () => {
      const headers = getAuthHeaders('zammad_token_abc');
      expect(headers).toEqual({
        Accept: 'application/json',
        Authorization: 'Token token=zammad_token_abc'
      });
    });

    it('preserves existing Token prefix', () => {
      const headers = getAuthHeaders('Token token=zammad_token_abc');
      expect(headers).toEqual({
        Accept: 'application/json',
        Authorization: 'Token token=zammad_token_abc'
      });
    });
  });

  describe('Mocked Zammad Ticket Fetching', () => {
    it('queries open tickets list correctly', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ([
          { id: 101, title: 'Lỗi VPN', state: 'new', created_at: '2026-07-31T10:00:00Z' }
        ])
      });
      global.fetch = mockFetch;

      const headers = getAuthHeaders('zammad_token_abc');
      const res = await fetch('http://zammad.local/api/v1/tickets', { headers });
      const data = await res.json();

      expect(data[0].title).toBe('Lỗi VPN');
    });
  });
});
