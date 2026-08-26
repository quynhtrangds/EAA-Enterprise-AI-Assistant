import { query } from '../../db/pool.js';
import { writeAuditLog } from '../../audit/audit-log.js';
import { AppError } from '../../errors/app-error.js';
import type { ProbeContext, ProbeStep, StepResult } from './probe-step.js';
import { getStrategy, type IntegrationTestStrategy } from './strategies/strategy.js';
import { ConfigProbe } from './probes/config.probe.js';
import { VaultProbe } from './probes/vault.probe.js';
import { McpServerProbe } from './probes/mcp-server.probe.js';
import { DnsProbe } from './probes/dns.probe.js';
import { TcpProbe } from './probes/tcp.probe.js';
import { TlsProbe } from './probes/tls.probe.js';
import { HttpProbe } from './probes/http.probe.js';
import { BusinessProbe } from './probes/business.probe.js';

export interface IntegrationTestResult {
  integrationCode: string;
  overallStatus: 'passed' | 'degraded' | 'failed';
  testedAt: string;
  durationMs: number;
  steps: StepResult[];
}

export interface IntegrationDraftInput {
  integrationCode: string;
  apiUrl?: string;
  apiKey?: string;
}

export class IntegrationTestService {
  static readonly TOTAL_TIMEOUT_MS = 15_000;

  // Vault chạy TRƯỚC config: với test đã lưu, secret trong Vault là nguồn chính
  // (vault-sync cấp creds cho MCP server từ Vault) — config sẽ dùng giá trị từ
  // Vault, chỉ fallback ra api_url trong DB khi Vault không có. Với draft test,
  // vault bị skip nên config vẫn là bước hiệu lực đầu tiên.
  private static readonly PROBES: ProbeStep[] = [
    new VaultProbe(),
    new ConfigProbe(),
    new McpServerProbe(),
    new DnsProbe(),
    new TcpProbe(),
    new TlsProbe(),
    new HttpProbe(),
    new BusinessProbe()
  ];

  /**
   * Test saved integration for a tenant
   * @param opts.skipAudit true → không ghi audit log cho lần test này
   *        (dùng cho health-check tự động — kết quả nằm trong integration_health_events)
   */
  static async testSaved(
    tenantId: string,
    integrationCode: string,
    userId: string,
    opts?: { skipAudit?: boolean }
  ): Promise<IntegrationTestResult> {
    const res = await query<{
      id: string;
      tenant_id: string;
      integration_code: string;
      vault_path: string | null;
      api_url: string | null;
      is_active: boolean;
    }>(
      `SELECT * FROM tenant_integrations WHERE tenant_id = $1 AND integration_code = $2`,
      [tenantId, integrationCode]
    );

    if (res.rows.length === 0 || !res.rows[0]) {
      throw new AppError('NOT_FOUND', `Tích hợp "${integrationCode}" chưa được cấu hình cho tổ chức này.`, 404);
    }

    const row = res.rows[0];
    const strategy = getStrategy(integrationCode);

    return this.runProbePipeline({
      tenantId,
      integrationCode,
      strategy,
      vaultPath: row.vault_path || undefined,
      // api_url trong DB chỉ là fallback — VaultProbe sẽ ưu tiên giá trị apiUrl trong Vault
      fallbackApiUrl: row.api_url || undefined,
      userId,
      skipAudit: opts?.skipAudit ?? false,
      isDraft: false
    });
  }

  /**
   * Test draft integration in form before saving
   */
  static async testDraft(tenantId: string, input: IntegrationDraftInput, userId: string): Promise<IntegrationTestResult> {
    const strategy = getStrategy(input.integrationCode);

    return this.runProbePipeline({
      tenantId,
      integrationCode: input.integrationCode,
      strategy,
      apiUrlString: input.apiUrl,
      apiKey: input.apiKey,
      userId,
      isDraft: true
    });
  }

  private static async runProbePipeline(params: {
    tenantId: string;
    integrationCode: string;
    strategy: IntegrationTestStrategy;
    vaultPath?: string;
    fallbackApiUrl?: string;
    apiUrlString?: string;
    apiKey?: string;
    userId: string;
    skipAudit?: boolean;
    isDraft: boolean;
  }): Promise<IntegrationTestResult> {
    const started = Date.now();
    const abortController = new AbortController();
    const timeoutTimer = setTimeout(() => abortController.abort(), this.TOTAL_TIMEOUT_MS);

    let apiUrl: URL | undefined = undefined;
    if (params.apiUrlString) {
      try {
        apiUrl = new URL(params.apiUrlString);
      } catch {
        // Handled by config probe
      }
    }

    const ctx: ProbeContext = {
      tenantId: params.tenantId,
      integrationCode: params.integrationCode,
      strategy: params.strategy,
      vaultPath: params.vaultPath,
      fallbackApiUrl: params.fallbackApiUrl,
      apiUrl,
      apiKey: params.apiKey,
      signal: abortController.signal,
      isDraft: params.isDraft
    };

    const steps: StepResult[] = [];

    try {
      for (let i = 0; i < this.PROBES.length; i++) {
        const probe = this.PROBES[i];
        if (!probe) continue;

        if (!probe.appliesTo(ctx)) {
          steps.push({
            step: probe.name,
            status: 'skipped',
            skipReason: 'not_applicable'
          });
          continue;
        }

        const stepResult = await probe.run(ctx);
        steps.push(stepResult);

        // Fail-Fast: Skip remaining probes if current probe fails
        if (stepResult.status === 'failed') {
          for (let j = i + 1; j < this.PROBES.length; j++) {
            const nextProbe = this.PROBES[j];
            if (nextProbe) {
              steps.push({
                step: nextProbe.name,
                status: 'skipped',
                skipReason: 'previous_step_failed'
              });
            }
          }
          break;
        }
      }
    } finally {
      clearTimeout(timeoutTimer);
    }

    const hasFailed = steps.some((s) => s.status === 'failed');
    const hasDegraded = !hasFailed && steps.some((s) => s.detail?.warning);
    const overallStatus: 'passed' | 'degraded' | 'failed' = hasFailed
      ? 'failed'
      : hasDegraded
      ? 'degraded'
      : 'passed';

    const durationMs = Date.now() - started;
    const testedAt = new Date().toISOString();

    // Persist result and write audit log for saved tests
    if (!params.isDraft) {
      const tasks: Promise<unknown>[] = [
        query(
          `UPDATE tenant_integrations
           SET last_tested_at = NOW(),
               last_test_status = $1,
               last_test_detail = $2
           WHERE tenant_id = $3 AND integration_code = $4`,
          [overallStatus, JSON.stringify(steps), params.tenantId, params.integrationCode]
        )
      ];
      // Health-check tự động bỏ audit (kết quả nằm trong integration_health_events)
      if (!params.skipAudit) {
        tasks.push(
          writeAuditLog({
            userId: params.userId,
            sessionId: null,
            toolName: `integration:test:${params.integrationCode}`,
            input: {
              integrationCode: params.integrationCode,
              isDraft: false
            },
            output: {
              overallStatus,
              durationMs,
              failedStep: steps.find((s) => s.status === 'failed')?.step
            },
            status: overallStatus === 'failed' ? 'failed' : 'success',
            errorMessage: steps.find((s) => s.status === 'failed')?.error?.message || null,
            durationMs
          })
        );
      }
      await Promise.allSettled(tasks);
    } else {
      // For draft tests, write audit log only
      try {
        await writeAuditLog({
          userId: params.userId,
          sessionId: null,
          toolName: `integration:test-draft:${params.integrationCode}`,
          input: {
            integrationCode: params.integrationCode,
            apiUrl: params.apiUrlString,
            isDraft: true
          },
          output: {
            overallStatus,
            durationMs,
            failedStep: steps.find((s) => s.status === 'failed')?.step
          },
          status: overallStatus === 'failed' ? 'failed' : 'success',
          errorMessage: steps.find((s) => s.status === 'failed')?.error?.message || null,
          durationMs
        });
      } catch {
        // Ignore audit log error in draft mode
      }
    }

    return {
      integrationCode: params.integrationCode,
      overallStatus,
      testedAt,
      durationMs,
      steps
    };
  }
}
