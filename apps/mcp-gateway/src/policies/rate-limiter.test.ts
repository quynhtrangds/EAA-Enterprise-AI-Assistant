import { describe, it, expect, beforeEach } from 'vitest';
import { checkToolRateLimit, checkLoginRateLimit, resetLoginRateLimitForTesting } from './rate-limiter.js';
import { AppError } from '../errors/app-error.js';

describe('Rate Limiter', () => {
  beforeEach(() => {
    resetLoginRateLimitForTesting();
  });

  describe('Tool Rate Limiter (checkToolRateLimit)', () => {
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

  describe('Login Username Rate Limiter (checkLoginRateLimit)', () => {
    it('cho phép tối đa 5 lần thử đăng nhập cho cùng một username trong 1 phút', () => {
      const username = 'admin_user';

      for (let i = 0; i < 5; i++) {
        expect(() => checkLoginRateLimit(username)).not.toThrow();
      }
    });

    it('chặn với lỗi 429 khi thử đăng nhập quá 5 lần/phút cho cùng một username', () => {
      const username = 'target_admin';

      for (let i = 0; i < 5; i++) {
        checkLoginRateLimit(username);
      }

      expect(() => checkLoginRateLimit(username)).toThrowError(AppError);
      try {
        checkLoginRateLimit(username);
      } catch (e: any) {
        expect(e.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(e.statusCode).toBe(429);
        expect(e.message).toContain('đang nhận quá nhiều yêu cầu đăng nhập liên tiếp');
      }
    });

    it('không phân biệt hoa thường khi tính hạn mức theo username (case-insensitive)', () => {
      const usernameLower = 'staff_user';
      const usernameUpper = 'STAFF_USER';

      for (let i = 0; i < 5; i++) {
        checkLoginRateLimit(usernameLower);
      }

      // Lần thứ 6 với chữ hoa vẫn phải bị chặn
      expect(() => checkLoginRateLimit(usernameUpper)).toThrowError(AppError);
    });

    it('các username khác nhau có hạn mức độc lập', () => {
      const userA = 'user_alice';
      const userB = 'user_bob';

      for (let i = 0; i < 5; i++) {
        checkLoginRateLimit(userA);
      }

      // userA bị chặn
      expect(() => checkLoginRateLimit(userA)).toThrowError(AppError);

      // userB vẫn thử được bình thường
      expect(() => checkLoginRateLimit(userB)).not.toThrow();
    });
  });
});
