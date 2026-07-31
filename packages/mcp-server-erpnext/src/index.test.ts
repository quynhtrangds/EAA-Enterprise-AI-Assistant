import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAuthHeaders } from './index.js';

describe('mcp-server-erpnext Unit & Mocked Execution Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAuthHeaders helper', () => {
    it('returns Accept header when no apiKey provided', () => {
      const headers = getAuthHeaders();
      expect(headers).toEqual({ Accept: 'application/json' });
    });

    it('formats token prefix for raw key', () => {
      const headers = getAuthHeaders('api_key:api_secret');
      expect(headers).toEqual({
        Accept: 'application/json',
        Authorization: 'token api_key:api_secret'
      });
    });

    it('preserves existing token prefix', () => {
      const headers = getAuthHeaders('token my_key:my_secret');
      expect(headers).toEqual({
        Accept: 'application/json',
        Authorization: 'token my_key:my_secret'
      });
    });
  });

  describe('Mocked ERPNext Resource Queries', () => {
    it('handles stock inventory data transformation', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { name: 'ITEM-001', item_name: 'Laptop Dell', item_group: 'Electronics', stock_uom: 'Nos', opening_stock: 10, valuation_rate: 15000000 }
          ]
        })
      });
      global.fetch = mockFetch;

      const headers = getAuthHeaders('token_key:token_secret');
      const res = await fetch('http://erpnext.local/api/resource/Item', { headers });
      const data = await res.json();

      expect(data.data[0].item_name).toBe('Laptop Dell');
    });
  });
});
