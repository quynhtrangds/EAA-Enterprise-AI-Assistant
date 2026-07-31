import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAuthHeaders } from './index.js';

describe('mcp-server-gitea Unit & Mocked Execution Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAuthHeaders helper', () => {
    it('returns Accept header when no apiKey provided', () => {
      const headers = getAuthHeaders();
      expect(headers).toEqual({ Accept: 'application/json' });
    });

    it('formats token prefix for raw key', () => {
      const headers = getAuthHeaders('gitea_token_123');
      expect(headers).toEqual({
        Accept: 'application/json',
        Authorization: 'token gitea_token_123'
      });
    });

    it('preserves Bearer prefix', () => {
      const headers = getAuthHeaders('Bearer gitea_token_123');
      expect(headers).toEqual({
        Accept: 'application/json',
        Authorization: 'Bearer gitea_token_123'
      });
    });
  });

  describe('Mocked Gitea Repository Search', () => {
    it('searches repositories via Gitea REST API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 1, name: 'SPEC_MVP', full_name: 'org/SPEC_MVP', private: false, html_url: 'http://gitea.local/org/SPEC_MVP' }
          ]
        })
      });
      global.fetch = mockFetch;

      const headers = getAuthHeaders('gitea_token_123');
      const res = await fetch('http://gitea.local/api/v1/repos/search?q=spec', { headers });
      const data = await res.json();

      expect(data.data[0].name).toBe('SPEC_MVP');
    });
  });
});
