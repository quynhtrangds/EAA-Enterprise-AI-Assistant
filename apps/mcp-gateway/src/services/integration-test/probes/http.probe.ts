import type { ProbeStep, ProbeContext, StepResult } from '../probe-step.js';
import { mapNetworkError } from '../errors.js';

export class HttpProbe implements ProbeStep {
  readonly name = 'http';

  appliesTo(ctx: ProbeContext): boolean {
    return ctx.strategy.kind === 'remote' && Boolean(ctx.apiUrl);
  }

  async run(ctx: ProbeContext): Promise<StepResult> {
    const started = Date.now();
    const reqSpec = ctx.strategy.buildTestRequest(ctx);
    const targetUrl = `${ctx.apiUrl!.origin}${reqSpec.path}`;

    try {
      const response = await fetch(targetUrl, {
        method: reqSpec.method,
        headers: reqSpec.headers,
        signal: ctx.signal,
        redirect: 'manual'
      });

      const latencyMs = Date.now() - started;

      if (response.status === 401 || response.status === 403) {
        return {
          step: this.name,
          status: 'failed',
          latencyMs,
          detail: {
            statusCode: response.status,
            endpoint: targetUrl
          },
          error: ctx.strategy.interpretAuthFailure(response.status)
        };
      }

      if (response.status === 404) {
        return {
          step: this.name,
          status: 'failed',
          latencyMs,
          detail: {
            statusCode: 404,
            endpoint: targetUrl
          },
          error: {
            code: 'TEST_ENDPOINT_NOT_FOUND',
            message: `Không tìm thấy endpoint kiểm tra: ${targetUrl} (HTTP 404)`,
            hint: 'Kiểm tra lại đường dẫn API URL (đảm bảo không thừa/thiếu tiền tố như /api/v1).'
          }
        };
      }

      if (response.status === 429) {
        return {
          step: this.name,
          status: 'failed',
          latencyMs,
          detail: {
            statusCode: 429,
            endpoint: targetUrl
          },
          error: {
            code: 'RATE_LIMITED',
            message: 'Máy chủ đích đang giới hạn tần suất gọi API (HTTP 429)',
            hint: 'Vui lòng chờ vài phút rồi thực hiện kiểm tra kết nối lại.'
          }
        };
      }

      if (response.status >= 500) {
        return {
          step: this.name,
          status: 'failed',
          latencyMs,
          detail: {
            statusCode: response.status,
            endpoint: targetUrl
          },
          error: {
            code: 'HTTP_SERVER_ERROR',
            message: `Máy chủ dịch vụ đích gặp lỗi nội bộ (HTTP ${response.status})`,
            hint: 'Kiểm tra log của hệ thống đích để biết nguyên nhân crash/lỗi máy chủ.'
          }
        };
      }

      if (!response.ok) {
        return {
          step: this.name,
          status: 'failed',
          latencyMs,
          detail: {
            statusCode: response.status,
            endpoint: targetUrl
          },
          error: {
            code: 'HTTP_UNEXPECTED_STATUS',
            message: `Máy chủ phản hồi mã trạng thái không mong muốn: HTTP ${response.status}`,
            hint: 'Kiểm tra lại cấu hình endpoint và tài liệu API của hệ thống đích.'
          }
        };
      }

      let responseBody: unknown = undefined;
      try {
        const text = await response.text();
        if (text) {
          responseBody = JSON.parse(text);
        }
      } catch {
        // Body is not JSON, ignore
      }

      // Check strategy body validation
      const validationErr = ctx.strategy.validateResponse(response.status, responseBody);
      if (validationErr) {
        return {
          step: this.name,
          status: 'failed',
          latencyMs,
          detail: {
            statusCode: response.status,
            endpoint: targetUrl
          },
          error: {
            code: 'BUSINESS_UNEXPECTED_RESPONSE',
            message: validationErr,
            hint: 'API URL phản hồi thành công nhưng nội dung không phải của dịch vụ mong đợi.'
          }
        };
      }

      return {
        step: this.name,
        status: 'passed',
        latencyMs,
        detail: {
          statusCode: response.status,
          endpoint: targetUrl,
          contentType: response.headers.get('content-type') || 'unknown'
        }
      };
    } catch (err) {
      return mapNetworkError(this.name, err, Date.now() - started);
    }
  }
}
