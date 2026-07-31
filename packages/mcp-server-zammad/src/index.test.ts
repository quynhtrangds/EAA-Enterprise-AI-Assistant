import { describe, it, expect } from 'vitest';
import { getAuthHeaders } from './index.js';

describe('mcp-server-zammad Unit Tests', () => {
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
});
