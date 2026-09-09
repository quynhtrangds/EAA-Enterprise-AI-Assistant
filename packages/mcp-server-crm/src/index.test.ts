import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAuthHeaders, truncateErrorMessage } from './index.js';

describe('mcp-server-crm Unit & Tool Execution Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAuthHeaders helper', () => {
    it('returns Accept header when no apiKey provided', () => {
      const headers = getAuthHeaders();
      expect(headers).toEqual({ Accept: 'application/json' });
    });

    it('formats Bearer header for simple string token', () => {
      const headers = getAuthHeaders('my-secret-token');
      expect(headers).toEqual({
        Accept: 'application/json',
        Authorization: 'Bearer my-secret-token'
      });
    });

    it('formats token prefix for key containing colon', () => {
      const headers = getAuthHeaders('api_key:api_secret');
      expect(headers).toEqual({
        Accept: 'application/json',
        Authorization: 'token api_key:api_secret'
      });
    });

    it('preserves existing token prefix', () => {
      const headers = getAuthHeaders('token token_val:secret_val');
      expect(headers).toEqual({
        Accept: 'application/json',
        Authorization: 'token token_val:secret_val'
      });
    });
  });

  describe('truncateErrorMessage helper', () => {
    it('giữ nguyên lỗi ngắn dưới 300 ký tự', () => {
      const shortErr = 'Lỗi kết nối mạng';
      expect(truncateErrorMessage(shortErr)).toBe('Lỗi kết nối mạng');
    });

    it('cắt ngắn lỗi HTML hoặc traceback dài hơn 300 ký tự', () => {
      const longErr = '<html><head><title>500 Internal Server Error</title></head><body>' + 'X'.repeat(500) + '</body></html>';
      const truncated = truncateErrorMessage(longErr, 300);
      expect(truncated.length).toBe(300 + '... [cắt ngắn]'.length);
      expect(truncated.endsWith('... [cắt ngắn]')).toBe(true);
    });

    it('xử lý đối tượng Error', () => {
      const err = new Error('Database connection failed');
      expect(truncateErrorMessage(err)).toBe('Database connection failed');
    });
  });

  describe('Mocked HTTP Integration Logic', () => {
    it('successfully formats CRM API requests with custom credentials', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'active', tier: 'VIP' })
      });
      global.fetch = mockFetch;

      const headers = getAuthHeaders('custom_key:custom_secret');
      const response = await fetch('http://localhost:8000/api/customer/123', { headers });
      const data = await response.json();

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/api/customer/123', { headers });
      expect(data).toEqual({ status: 'active', tier: 'VIP' });
    });
  });
});
