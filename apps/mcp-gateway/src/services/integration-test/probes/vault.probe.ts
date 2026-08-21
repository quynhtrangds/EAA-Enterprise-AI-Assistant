import type { ProbeStep, ProbeContext, StepResult } from '../probe-step.js';
import { VaultService } from '../../vault.js';

export class VaultProbe implements ProbeStep {
  readonly name = 'vault';

  appliesTo(ctx: ProbeContext): boolean {
    // Draft tests with provided credentials don't require Vault read
    return !ctx.isDraft && Boolean(ctx.vaultPath);
  }

  async run(ctx: ProbeContext): Promise<StepResult> {
    const started = Date.now();
    try {
      if (!ctx.vaultPath) {
        return {
          step: this.name,
          status: 'passed',
          latencyMs: Date.now() - started,
          detail: { mode: 'draft_or_no_vault' }
        };
      }

      const secret = (await VaultService.readSecret(ctx.vaultPath)) as { apiUrl?: string; apiKey?: string } | null;
      if (!secret) {
        return {
          step: this.name,
          status: 'failed',
          latencyMs: Date.now() - started,
          error: {
            code: 'VAULT_SECRET_NOT_FOUND',
            message: `Không tìm thấy secret tại đường dẫn ${ctx.vaultPath}`,
            hint: 'Lưu lại cấu hình tích hợp để hệ thống ghi mới secret vào HashiCorp Vault.'
          }
        };
      }

      // Populate ctx if not already set
      if (secret.apiUrl && !ctx.apiUrl) {
        ctx.apiUrl = new URL(secret.apiUrl);
      }
      if (secret.apiKey && !ctx.apiKey) {
        ctx.apiKey = secret.apiKey;
      }

      return {
        step: this.name,
        status: 'passed',
        latencyMs: Date.now() - started,
        detail: {
          vaultPath: ctx.vaultPath,
          hasApiUrl: Boolean(secret.apiUrl),
          hasApiKey: Boolean(secret.apiKey)
        }
      };
    } catch (err: any) {
      return {
        step: this.name,
        status: 'failed',
        latencyMs: Date.now() - started,
        error: {
          code: 'VAULT_UNAVAILABLE',
          message: err?.message || 'Không thể kết nối tới máy chủ HashiCorp Vault',
          hint: 'Kiểm tra container Vault và token truy cập VAULT_TOKEN trong file .env.'
        }
      };
    }
  }
}
