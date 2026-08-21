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
