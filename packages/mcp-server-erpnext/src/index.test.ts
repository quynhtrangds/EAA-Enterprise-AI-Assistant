import { describe, it, expect } from 'vitest';
import { getAuthHeaders } from './index.js';

describe('mcp-server-erpnext Unit Tests', () => {
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
});
