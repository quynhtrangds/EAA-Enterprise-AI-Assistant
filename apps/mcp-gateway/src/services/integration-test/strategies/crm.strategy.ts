import type { IntegrationTestStrategy, TestRequestSpec } from './strategy.js';
import type { ProbeContext } from '../probe-step.js';
import type { ProbeError } from '../errors.js';

/**
 * CRM connector (mcp-server-crm) là client Frappe API thật — các tool
 * (crm_get_customer_status...) gọi `${apiUrl}/api/resource/Customer`,
 * `/api/resource/Lead`... và BẮT BUỘC có apiUrl (không có thì tool báo lỗi).
 * Nên test connection phải chạy đầy đủ các bước mạng như ERPNext.
 */
export class CrmStrategy implements IntegrationTestStrategy {
  readonly code = 'crm' as const;
  readonly kind = 'remote' as const;

  buildTestRequest(ctx: ProbeContext): TestRequestSpec {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (ctx.apiKey) {
      // Giữ đúng logic getAuthHeaders() của packages/mcp-server-crm/src/index.ts:
      // đã có tiền tố "token " → giữ nguyên; dạng "key:secret" → token key:secret;
      // còn lại → Bearer.
      if (ctx.apiKey.startsWith('token ')) {
        headers.Authorization = ctx.apiKey;
      } else if (ctx.apiKey.includes(':')) {
        headers.Authorization = `token ${ctx.apiKey}`;
      } else {
        headers.Authorization = `Bearer ${ctx.apiKey}`;
      }
    }
    // Endpoint xác thực "rẻ nhất" của Frappe — cùng họ API mà CRM connector gọi thật
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
    return 'Phản hồi từ CRM (Frappe) không chứa trường "message" chứa thông tin user đăng nhập.';
  }

  interpretAuthFailure(statusCode: number): ProbeError {
    return statusCode === 401
      ? {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'CRM (Frappe) trả về 401 Unauthorized (API Key/Secret không hợp lệ)',
          hint: 'Đảm bảo định dạng token là "api_key:api_secret" (tạo từ hồ sơ user → API Access trong Frappe/ERPNext).'
        }
      : {
          code: 'AUTH_FORBIDDEN',
          message: 'CRM (Frappe) trả về 403 Forbidden (Tài khoản bị khóa hoặc thiếu quyền)',
          hint: 'Kiểm tra tài khoản API user trong Frappe có quyền đọc Customer/Lead không.'
        };
  }
}
