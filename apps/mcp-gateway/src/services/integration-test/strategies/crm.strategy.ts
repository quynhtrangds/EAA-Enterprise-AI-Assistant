import type { IntegrationTestStrategy, TestRequestSpec } from './strategy.js';
import type { ProbeContext, StepResult } from '../probe-step.js';
import type { ProbeError } from '../errors.js';
import { mcpClientManager } from '../../../connectors/mcp-client-manager.js';

export class CrmStrategy implements IntegrationTestStrategy {
  readonly code = 'crm' as const;
  readonly kind = 'internal' as const;

  buildTestRequest(_ctx: ProbeContext): TestRequestSpec {
    return { method: 'GET', path: '/', headers: {} };
  }

  validateResponse(_status: number, _body: unknown): string | null {
    return null;
  }

  interpretAuthFailure(_statusCode: number): ProbeError {
    return {
      code: 'AUTH_ERROR',
      message: 'Lỗi xác thực CRM',
      hint: 'Kiểm tra cấu hình tích hợp CRM.'
    };
  }

  async runInternalProbe(_ctx: ProbeContext): Promise<StepResult> {
    const started = Date.now();
    try {
      const isConn = mcpClientManager.isConnected('crm');
      if (!isConn) {
        return {
          step: 'business',
          status: 'failed',
          latencyMs: Date.now() - started,
          error: {
            code: 'MCP_SERVER_NOT_CONNECTED',
            message: 'MCP Server cho dịch vụ CRM chưa kết nối',
            hint: 'Kiểm tra tiến trình MCP Server CRM trong connector.json.'
          }
        };
      }

      return {
        step: 'business',
        status: 'passed',
        latencyMs: Date.now() - started,
        detail: {
          server: 'crm',
          mode: 'internal_mcp_connector'
        }
      };
    } catch (err: any) {
      return {
        step: 'business',
        status: 'failed',
        latencyMs: Date.now() - started,
        error: {
          code: 'BUSINESS_ERROR',
          message: err?.message || 'Lỗi kiểm tra dịch vụ CRM',
          hint: 'Kiểm tra log của MCP Server CRM.'
        }
      };
    }
  }
}
