import { AppError } from '../errors/app-error.js';

interface RateLimitData {
  count: number;
  resetAt: number;
}

// Map key: `${userId}:${toolName}`
const rateLimitStore = new Map<string, RateLimitData>();

const MAX_REQUESTS_PER_TOOL_PER_MINUTE = 20;
const WINDOW_MS = 60 * 1000; // 1 minute

export function checkToolRateLimit(userId: string, toolName: string) {
  const now = Date.now();
  const key = `${userId}:${toolName}`;
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
