import type { ProbeStep, ProbeContext, StepResult } from '../probe-step.js';

export class ConfigProbe implements ProbeStep {
  readonly name = 'config';

  appliesTo(_ctx: ProbeContext): boolean {
    return true;
  }

  async run(ctx: ProbeContext): Promise<StepResult> {
    const started = Date.now();

    // Fallback: Vault không có apiUrl (hoặc vault bị skip) thì dùng api_url trong DB.
    // Lưu ý bước vault chạy TRƯỚC config nên nếu Vault có giá trị thì ctx.apiUrl đã là của Vault.
    if (ctx.strategy.kind === 'remote' && !ctx.apiUrl && ctx.fallbackApiUrl) {
      try {
        ctx.apiUrl = new URL(ctx.fallbackApiUrl);
      } catch {
        // fallbackApiUrl sai định dạng — coi như chưa có URL, báo lỗi bên dưới
      }
    }

    // Check apiUrl for remote strategies
    if (ctx.strategy.kind === 'remote' && !ctx.apiUrl) {
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

    const maskedUrl = ctx.apiUrl ? `${ctx.apiUrl.protocol}//${ctx.apiUrl.host}${ctx.apiUrl.pathname}` : 'N/A (Nội bộ)';
    const maskedKey = ctx.apiKey
      ? (ctx.apiKey.length > 8 ? `${ctx.apiKey.slice(0, 3)}****${ctx.apiKey.slice(-4)}` : '****')
      : 'Không có / Bỏ trống';

    return {
      step: this.name,
      status: 'passed',
      latencyMs: Date.now() - started,
      detail: {
        integrationCode: ctx.integrationCode,
        apiUrl: maskedUrl,
        apiKey: maskedKey,
        kind: ctx.strategy.kind
      }
    };
  }
}
