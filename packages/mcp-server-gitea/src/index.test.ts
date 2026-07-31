import { describe, it, expect } from 'vitest';
import { getAuthHeaders } from './index.js';

describe('mcp-server-gitea Unit Tests', () => {
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
});
