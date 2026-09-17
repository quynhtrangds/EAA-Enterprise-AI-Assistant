import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkToolRateLimit,
  checkLoginRateLimit,
  resetLoginRateLimitForTesting,
  cleanupRateLimitStores,
  getRateLimitStoreSizesForTesting
} from './rate-limiter.js';
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

  describe('Rate Limiter Memory Leak Cleanup (cleanupRateLimitStores)', () => {
    it('dọn dẹp sạch các mục đã hết hạn và giữ nguyên các mục còn hiệu lực', () => {
      const now = Date.now();

      // Tạo các entry
      checkToolRateLimit('user-active', 'tool_1', 'session-1');
      checkLoginRateLimit('active_user');

      const initialSizes = getRateLimitStoreSizesForTesting();
      expect(initialSizes.toolStoreSize).toBe(1);
      expect(initialSizes.loginStoreSize).toBe(1);

      // Chạy dọn dẹp tại thời điểm hiện tại -> không mục nào bị xóa
      const clean1 = cleanupRateLimitStores(now);
      expect(clean1.cleanedTools).toBe(0);
      expect(clean1.cleanedLogins).toBe(0);

      const midSizes = getRateLimitStoreSizesForTesting();
      expect(midSizes.toolStoreSize).toBe(1);
      expect(midSizes.loginStoreSize).toBe(1);

      // Giả lập thời gian sau 65 giây (đã quá WINDOW_MS 60s)
      const futureNow = now + 65 * 1000;
      const clean2 = cleanupRateLimitStores(futureNow);
      expect(clean2.cleanedTools).toBe(1);
      expect(clean2.cleanedLogins).toBe(1);

      const finalSizes = getRateLimitStoreSizesForTesting();
      expect(finalSizes.toolStoreSize).toBe(0);
      expect(finalSizes.loginStoreSize).toBe(0);
    });

    it('giải phóng bộ nhớ cho nhiều session ngẫu nhiên của guest', () => {
      const now = Date.now();

      for (let i = 0; i < 50; i++) {
        checkToolRateLimit('guest', 'search_customer', `random-session-${i}`);
        checkLoginRateLimit(`random-user-${i}`);
      }

      expect(getRateLimitStoreSizesForTesting().toolStoreSize).toBe(50);
      expect(getRateLimitStoreSizesForTesting().loginStoreSize).toBe(50);

      // Sau 61 giây
      cleanupRateLimitStores(now + 61 * 1000);

      expect(getRateLimitStoreSizesForTesting().toolStoreSize).toBe(0);
      expect(getRateLimitStoreSizesForTesting().loginStoreSize).toBe(0);
    });
  });
});
