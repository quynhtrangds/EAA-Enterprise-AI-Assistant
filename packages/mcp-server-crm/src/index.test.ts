import { describe, it, expect } from 'vitest';
import { getAuthHeaders } from './index.js';

describe('mcp-server-crm Unit Tests', () => {
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
});
