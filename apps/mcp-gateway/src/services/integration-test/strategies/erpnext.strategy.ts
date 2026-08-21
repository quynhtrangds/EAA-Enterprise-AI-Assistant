import type { IntegrationTestStrategy, TestRequestSpec } from './strategy.js';
import type { ProbeContext } from '../probe-step.js';
import type { ProbeError } from '../errors.js';

export class ErpNextStrategy implements IntegrationTestStrategy {
  readonly code = 'erpnext' as const;
  readonly kind = 'remote' as const;

  buildTestRequest(ctx: ProbeContext): TestRequestSpec {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (ctx.apiKey) {
      headers.Authorization = ctx.apiKey.startsWith('token ')
        ? ctx.apiKey
        : `token ${ctx.apiKey}`;
    }
    return {
      method: 'GET',
      path: '/api/method/frappe.auth.get_logged_user',
      headers
    };
  }

  validateResponse(_status: number, body: unknown): string | null {
    if (typeof body === 'object' && body !== null && 'message' in body) {
      return null;
    }
    return 'Phản hồi từ ERPNext không chứa trường "message" chứa thông tin user đăng nhập.';
  }

  interpretAuthFailure(statusCode: number): ProbeError {
    return statusCode === 401
      ? {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'ERPNext trả về 401 Unauthorized (API Key/Secret không hợp lệ)',
          hint: 'Đảm bảo định dạng token là "api_key:api_secret" (tạo từ User Settings → API Access trong ERPNext).'
        }
      : {
          code: 'AUTH_FORBIDDEN',
          message: 'ERPNext trả về 403 Forbidden (Tài khoản bị khóa hoặc thiếu Role)',
          hint: 'Kiểm tra tài khoản API User trong ERPNext có quyền System Manager / Read API.'
        };
  }
}
