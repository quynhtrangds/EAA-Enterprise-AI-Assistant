import { AppError } from '../errors/app-error.js';

interface RateLimitData {
  count: number;
  resetAt: number;
}

// Map key: `${userId}:${sessionId}:${toolName}`
//
// sessionId được đưa vào key vì luồng guest (POST /api/auth/guest) cấp token
// cho một user_id CỐ ĐỊNH DÙNG CHUNG cho mọi khách vãng lai (xem
// auth/auth-sessions.ts + route /auth/guest). Nếu chỉ khoá theo userId, toàn
// bộ khách vãng lai trên hệ thống sẽ chia sẻ chung 1 hạn mức 20 req/phút cho
// mỗi tool — một khách gọi nhiều sẽ khiến các khách khác bị chặn dù họ chưa
// gọi request nào. Thêm sessionId (mỗi phiên chat/token là một sessionId
// khác nhau) tách hạn mức ra theo từng phiên, không còn bị "goá lây" giữa các
// guest. Đánh đổi: một user thật (không phải guest) mở nhiều tab/phiên cũng
// sẽ có nhiều hạn mức riêng thay vì dùng chung 1 hạn mức theo userId — chấp
// nhận được ở quy mô MVP vì rate-limit ở đây chỉ nhằm chống lạm dụng vô tình,
// không phải hàng rào bảo mật chính.
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
