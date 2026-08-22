import type { IntegrationTestStrategy, TestRequestSpec } from './strategy.js';
import type { ProbeContext } from '../probe-step.js';
import type { ProbeError } from '../errors.js';

export class GiteaStrategy implements IntegrationTestStrategy {
  readonly code = 'gitea' as const;
  readonly kind = 'remote' as const;

  buildTestRequest(ctx: ProbeContext): TestRequestSpec {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (ctx.apiKey) {
      headers.Authorization = ctx.apiKey.startsWith('token ') || ctx.apiKey.startsWith('Bearer ')
        ? ctx.apiKey
        : `token ${ctx.apiKey}`;
    }
    return {
      method: 'GET',
      path: '/api/v1/user',
      headers
    };
  }

  validateResponse(_status: number, body: unknown): string | null {
    if (typeof body === 'object' && body !== null && 'login' in body) {
      return null;
    }
    return 'Phản hồi từ máy chủ không chứa trường "login" của người dùng Gitea.';
  }

  interpretAuthFailure(statusCode: number): ProbeError {
    return statusCode === 401
      ? {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Gitea trả về 401 Unauthorized (Token không hợp lệ hoặc đã hết hạn)',
          hint: 'Truy cập Gitea (Settings → Applications → Generate New Token) và cập nhật API Token mới.'
        }
      : {
          code: 'AUTH_FORBIDDEN',
          message: 'Gitea trả về 403 Forbidden (Token thiếu quyền truy cập)',
          hint: 'Kiểm tra lại quyền hạn (scopes: read:user, read:repository) của Token trong Gitea.'
        };
  }
}
