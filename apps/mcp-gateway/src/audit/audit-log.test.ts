import { describe, it, expect } from 'vitest';
import { sanitizeForLog } from './audit-log.js';

describe('sanitizeForLog - Audit log credential stripping', () => {
  it('Should strip _integrationCredentials completely', () => {
    const input = {
      query: 'SELECT * FROM orders',
      _integrationCredentials: {
        apiKey: 'secret_12345',
        apiUrl: 'http://localhost:8080'
      }
    };

    const sanitized = sanitizeForLog(input);
    expect(sanitized).toEqual({
      query: 'SELECT * FROM orders'
    });
    expect(sanitized._integrationCredentials).toBeUndefined();
  });

  it('Should redact sensitive keys like apiKey, password, secret, token', () => {
    const input = {
      username: 'admin',
      password: 'super_secret_password',
      apiKey: 'key_abc_xyz',
      nested: {
        token: 'jwt_token_here',
        normalField: 'hello'
      }
    };

    const sanitized = sanitizeForLog(input);
    expect(sanitized).toEqual({
      username: 'admin',
      password: '[REDACTED]',
      apiKey: '[REDACTED]',
      nested: {
        token: '[REDACTED]',
        normalField: 'hello'
      }
    });
  });
});
