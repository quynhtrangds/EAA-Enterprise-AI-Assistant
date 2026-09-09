import type { ProbeStep, ProbeContext, StepResult } from '../probe-step.js';
import { isRemoteStrategy } from '../strategies/strategy.js';
import { validateIntegrationUrlAsync } from '../../../policies/url-validator.js';

export class ConfigProbe implements ProbeStep {
  readonly name = 'config';

  appliesTo(_ctx: ProbeContext): boolean {
    return true;
  }

  async run(ctx: ProbeContext): Promise<StepResult> {
    const started = Date.now();
    const remote = isRemoteStrategy(ctx.strategy, ctx);

    // Fallback: Vault không có apiUrl (hoặc vault bị skip) thì dùng api_url trong DB.
    // Lưu ý bước vault chạy TRƯỚC config nên nếu Vault có giá trị thì ctx.apiUrl đã là của Vault.
    if (remote && !ctx.apiUrl && ctx.fallbackApiUrl) {
      try {
        ctx.apiUrl = new URL(ctx.fallbackApiUrl);
      } catch {
        // fallbackApiUrl sai định dạng — coi như chưa có URL, báo lỗi bên dưới
      }
    }

    // Check apiUrl for remote strategies
    if (remote && !ctx.apiUrl) {
      return {
        step: this.name,
        status: 'failed',
        latencyMs: Date.now() - started,
        error: {
          code: 'INTEGRATION_NOT_CONFIGURED',
          message: `Chưa cấu hình API URL cho dịch vụ ${ctx.integrationCode}`,
          hint: 'Vui lòng nhập API URL hợp lệ (ví dụ: https://gitea.example.com) trong phần Cài đặt.'
        }
      };
    }

    // SSRF & DNS Rebinding Validation (áp dụng thống nhất cho cả testDraft, testSaved và health-check)
    if (remote && ctx.apiUrl) {
      try {
        await validateIntegrationUrlAsync(ctx.apiUrl.toString());
      } catch (err: any) {
        return {
          step: this.name,
          status: 'failed',
          latencyMs: Date.now() - started,
          error: {
            code: 'SSRF_BLOCKED',
            message: err.message || 'URL tích hợp vi phạm chính sách bảo mật hoặc phân giải về địa chỉ IP nội bộ bị hạn chế (SSRF / DNS Rebinding Protection).',
            hint: 'Kiểm tra lại hostname/IP của URL, đảm bảo không trỏ về mạng nội bộ, localhost hoặc metadata service.'
          }
        };
      }
    }

    const maskedUrl = ctx.apiUrl ? `${ctx.apiUrl.protocol}//${ctx.apiUrl.host}${ctx.apiUrl.pathname}` : 'N/A (Nội bộ)';
    // Mask nhất quán với maskSecret phía admin route: chỉ hiện 4 ký tự cuối
    const maskedKey = ctx.apiKey
      ? (ctx.apiKey.length > 4 ? `****${ctx.apiKey.slice(-4)}` : '****')
      : 'Không có / Bỏ trống';

    return {
      step: this.name,
      status: 'passed',
      latencyMs: Date.now() - started,
      detail: {
        integrationCode: ctx.integrationCode,
        apiUrl: maskedUrl,
        apiKey: maskedKey,
        mode: remote ? 'remote' : 'internal'
      }
    };
  }
}
