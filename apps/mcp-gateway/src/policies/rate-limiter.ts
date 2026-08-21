import rateLimit from 'express-rate-limit';
import { AppError } from '../errors/app-error.js';

interface RateLimitData {
  count: number;
  resetAt: number;
}

/**
 * IP-based Rate Limiter cho các route xác thực /login và /auth/google
 * Hạn mức: 10 requests / phút / IP
 */
export const loginIpRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    errorCode: 'RATE_LIMIT_EXCEEDED',
    message: 'Quá nhiều yêu cầu đăng nhập từ địa chỉ IP này. Vui lòng thử lại sau 1 phút.'
  }
});

// Map key: `${userId}:${sessionId}:${toolName}`
const rateLimitStore = new Map<string, RateLimitData>();

const MAX_REQUESTS_PER_TOOL_PER_MINUTE = 20;
const WINDOW_MS = 60 * 1000; // 1 minute

export function checkToolRateLimit(userId: string, toolName: string, sessionId?: string) {
  const now = Date.now();
  const key = `${userId}:${sessionId ?? 'default'}:${toolName}`;
  const data = rateLimitStore.get(key);

  if (!data) {
    rateLimitStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  if (now > data.resetAt) {
    // Window expired, reset
    rateLimitStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  if (data.count >= MAX_REQUESTS_PER_TOOL_PER_MINUTE) {
    throw new AppError('RATE_LIMIT_EXCEEDED', `Rate limit exceeded for tool: ${toolName}. Please wait before trying again.`, 429);
  }

  data.count += 1;
}

/**
 * Rate Limiter theo Username trong bộ nhớ
 * Hạn mức: 5 requests / phút / username
 * Chặn đứng các đợt tấn công brute-force phân tán (nhiều IP nhắm vào 1 username)
 */
const loginUsernameRateLimitStore = new Map<string, RateLimitData>();
const MAX_LOGIN_ATTEMPTS_PER_USERNAME_PER_MINUTE = 5;
const LOGIN_USERNAME_WINDOW_MS = 60 * 1000;

export function checkLoginRateLimit(username: string) {
  if (!username) return;
  const normalized = username.trim().toLowerCase();
  const key = `login:${normalized}`;
  const now = Date.now();
  const data = loginUsernameRateLimitStore.get(key);

  if (!data) {
    loginUsernameRateLimitStore.set(key, { count: 1, resetAt: now + LOGIN_USERNAME_WINDOW_MS });
    return;
  }

  if (now > data.resetAt) {
    loginUsernameRateLimitStore.set(key, { count: 1, resetAt: now + LOGIN_USERNAME_WINDOW_MS });
    return;
  }

  if (data.count >= MAX_LOGIN_ATTEMPTS_PER_USERNAME_PER_MINUTE) {
    throw new AppError(
      'RATE_LIMIT_EXCEEDED',
      `Tài khoản "${username}" đang nhận quá nhiều yêu cầu đăng nhập liên tiếp. Vui lòng thử lại sau 1 phút.`,
      429
    );
  }

  data.count += 1;
}

export function resetLoginRateLimitForTesting() {
  loginUsernameRateLimitStore.clear();
  rateLimitStore.clear();
}
