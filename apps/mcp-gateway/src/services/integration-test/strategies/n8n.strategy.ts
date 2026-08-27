import type { IntegrationTestStrategy, TestRequestSpec } from './strategy.js';
import type { ProbeContext } from '../probe-step.js';
import type { ProbeError } from '../errors.js';

export class N8nStrategy implements IntegrationTestStrategy {
  readonly code = 'n8n';
  readonly kind = 'remote';
  readonly defaultPort = 5678;

  buildTestRequest(ctx: ProbeContext): TestRequestSpec {
    const headers: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*'
    };

    if (ctx.apiKey) {
      headers['X-N8N-API-KEY'] = ctx.apiKey;
    }

    return {
      method: 'GET',
      path: '/healthz',
      headers
    };
  }

  validateResponse(_status: number, _body: unknown): string | null {
    return null;
  }

  interpretAuthFailure(statusCode: number): ProbeError {
    return {
      code: 'AUTH_INVALID_CREDENTIALS',
      message: `n8n trả về lỗi xác thực HTTP ${statusCode} (API Key không hợp lệ hoặc thiếu quyền)`,
      hint: 'Kiểm tra lại n8n API Key (tạo từ Settings → n8n API trong giao diện n8n).'
    };
  }
}
