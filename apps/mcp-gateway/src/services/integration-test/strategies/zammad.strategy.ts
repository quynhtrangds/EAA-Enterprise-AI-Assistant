import type { IntegrationTestStrategy, TestRequestSpec } from './strategy.js';
import type { ProbeContext } from '../probe-step.js';
import type { ProbeError } from '../errors.js';

export class ZammadStrategy implements IntegrationTestStrategy {
  readonly code = 'zammad' as const;
  readonly kind = 'remote' as const;

  buildTestRequest(ctx: ProbeContext): TestRequestSpec {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (ctx.apiKey) {
      headers.Authorization = ctx.apiKey.startsWith('Token token=')
        ? ctx.apiKey
        : `Token token=${ctx.apiKey}`;
    }
    return {
      method: 'GET',
      path: '/api/v1/users/me',
      headers
    };
  }

  validateResponse(_status: number, body: unknown): string | null {
    if (typeof body === 'object' && body !== null && ('id' in body || 'login' in body || 'email' in body)) {
      return null;
    }
    return 'Phản hồi từ Zammad không chứa thông tin tài khoản hợp lệ.';
  }

  interpretAuthFailure(statusCode: number): ProbeError {
    return statusCode === 401
      ? {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Zammad trả về 401 Unauthorized (API Token không chính xác)',
          hint: 'Tạo API Token cá nhân mới trong Zammad (Profile → Token Access) với quyền "ticket.agent" hoặc "admin".'
        }
      : {
          code: 'AUTH_FORBIDDEN',
          message: 'Zammad trả về 403 Forbidden (Thiếu quyền truy cập)',
          hint: 'Kiểm tra phân quyền tài khoản sở hữu Token trong Zammad Helpdesk.'
        };
  }
}
