import { describe, it, expect } from 'vitest';
import { checkToolRateLimit } from './rate-limiter.js';
import { AppError } from '../errors/app-error.js';

describe('Rate Limiter', () => {
  it('should allow requests under the limit', () => {
    const userId = `user1-${Date.now()}`;
    const toolName = 'test_tool';

    // Call 20 times (MAX_REQUESTS_PER_TOOL_PER_MINUTE)
    for (let i = 0; i < 20; i++) {
      expect(() => checkToolRateLimit(userId, toolName)).not.toThrow();
    }
  });

  it('should block requests over the limit', () => {
    const userId = `user2-${Date.now()}`;
    const toolName = 'test_tool';

    for (let i = 0; i < 20; i++) {
      checkToolRateLimit(userId, toolName);
    }

    try {
      checkToolRateLimit(userId, toolName);
      expect.fail('Should have thrown an error');
    } catch (e: any) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(e.statusCode).toBe(429);
    }
  });

  it('should track limits per tool independently for the same user', () => {
    const userId = `user3-${Date.now()}`;
    const tool1 = 'tool_A';
    const tool2 = 'tool_B';

    for (let i = 0; i < 20; i++) {
      checkToolRateLimit(userId, tool1);
    }

    // tool1 should throw
    expect(() => checkToolRateLimit(userId, tool1)).toThrowError(AppError);

    // tool2 should be fine
    expect(() => checkToolRateLimit(userId, tool2)).not.toThrow();
  });

  it('should track limits per session independently for the same userId (guest scenario)', () => {
    // Guest login dùng chung 1 userId cố định cho mọi khách vãng lai
    // (xem routes/tools.ts /auth/guest). Nếu không tách theo sessionId, một
    // guest gọi nhiều sẽ khoá luôn các guest khác dùng chung userId đó.
    const sharedGuestUserId = `guest-shared-${Date.now()}`;
    const toolName = 'test_tool';
    const sessionA = 'session-A';
    const sessionB = 'session-B';

    for (let i = 0; i < 20; i++) {
      checkToolRateLimit(sharedGuestUserId, toolName, sessionA);
    }

    // Phiên A đã đạt hạn mức, phải bị chặn
    expect(() => checkToolRateLimit(sharedGuestUserId, toolName, sessionA)).toThrowError(AppError);

    // Phiên B của cùng userId nhưng khác sessionId phải KHÔNG bị ảnh hưởng
    expect(() => checkToolRateLimit(sharedGuestUserId, toolName, sessionB)).not.toThrow();
  });
});