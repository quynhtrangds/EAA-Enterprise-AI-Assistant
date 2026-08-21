import type { IntegrationTestStrategy } from './strategies/strategy.js';

export type StepStatus = 'passed' | 'failed' | 'skipped';

export interface StepResult {
  step: string;
  status: StepStatus;
  latencyMs?: number;
  detail?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    hint?: string;
  };
  skipReason?: string;
}

export interface ProbeContext {
  tenantId: string;
  integrationCode: string;
  apiUrl?: URL;
  apiKey?: string;
  vaultPath?: string;
  // api_url lưu trong DB (tenant_integrations) — chỉ dùng khi Vault không có apiUrl,
  // vì nguồn chính của luồng chạy thật là Vault (xem GET /integrations: secrets?.apiUrl || row.api_url)
  fallbackApiUrl?: string;
  strategy: IntegrationTestStrategy;
  signal: AbortSignal;
  resolvedIp?: string;
  isDraft?: boolean;
}

export interface ProbeStep {
  readonly name: string;
  appliesTo(ctx: ProbeContext): boolean;
  run(ctx: ProbeContext): Promise<StepResult>;
}
