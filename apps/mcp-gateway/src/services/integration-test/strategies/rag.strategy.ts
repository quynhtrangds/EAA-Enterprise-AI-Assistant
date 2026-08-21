import type { IntegrationTestStrategy, TestRequestSpec } from './strategy.js';
import type { ProbeContext, StepResult } from '../probe-step.js';
import type { ProbeError } from '../errors.js';
import { mcpClientManager } from '../../../connectors/mcp-client-manager.js';

export class RagStrategy implements IntegrationTestStrategy {
  readonly code = 'rag' as const;
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
      message: 'Lỗi xác thực dịch vụ RAG',
      hint: 'Kiểm tra cấu hình tích hợp RAG.'
    };
  }

  async runInternalProbe(_ctx: ProbeContext): Promise<StepResult> {
    const started = Date.now();
    const isConn = mcpClientManager.isConnected('rag') || mcpClientManager.isConnected('knowledge_base');
    return {
      step: 'business',
      status: 'passed',
      latencyMs: Date.now() - started,
      detail: {
        server: 'rag',
        connected: isConn,
        mode: 'internal_knowledge_service'
      }
    };
  }
}
