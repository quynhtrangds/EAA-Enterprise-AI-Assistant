import type { IntegrationTestStrategy, TestRequestSpec } from './strategy.js';
import type { ProbeContext, StepResult } from '../probe-step.js';
import type { ProbeError } from '../errors.js';
import { mcpClientManager } from '../../../connectors/mcp-client-manager.js';

/**
 * RAG connector (mcp-server-rag) là connector LAI:
 * - Có apiUrl → gọi API tìm kiếm ngoài `${apiUrl}/api/v1/search` (xem index.ts
 *   của mcp-server-rag) → test như dịch vụ remote.
 * - Không có apiUrl → dùng kho tri thức nội bộ → chỉ cần MCP server còn sống.
 */
export class RagStrategy implements IntegrationTestStrategy {
  readonly code = 'rag' as const;
  readonly kind = 'internal' as const;

  isRemote(ctx: ProbeContext): boolean {
    return Boolean(ctx.apiUrl);
  }

  buildTestRequest(ctx: ProbeContext): TestRequestSpec {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (ctx.apiKey) {
      // Khớp cách mcp-server-rag gửi auth khi gọi API tìm kiếm ngoài
      headers.Authorization = ctx.apiKey.startsWith('Bearer ')
        ? ctx.apiKey
        : `Bearer ${ctx.apiKey}`;
    }
    // Kiểm tra độ phủ sóng: chỉ cần dịch vụ phản hồi, không validate shape
    // (API tìm kiếm là POST có body — không dùng để test tránh side-effect)
    return { method: 'GET', path: '/', headers };
  }

  validateResponse(_status: number, _body: unknown): string | null {
    return null;
  }

  interpretAuthFailure(statusCode: number): ProbeError {
    return {
      code: statusCode === 401 ? 'AUTH_INVALID_CREDENTIALS' : 'AUTH_FORBIDDEN',
      message: `Dịch vụ RAG trả về ${statusCode} (API Key không hợp lệ hoặc thiếu quyền)`,
      hint: 'Kiểm tra lại API Key của dịch vụ RAG trong phần Cấu hình Tích hợp.'
    };
  }

  async runInternalProbe(_ctx: ProbeContext): Promise<StepResult> {
    const started = Date.now();
    const isConn = mcpClientManager.isConnected('rag') || mcpClientManager.isConnected('knowledge_base');
    if (!isConn) {
      return {
        step: 'business',
        status: 'failed',
        latencyMs: Date.now() - started,
        error: {
          code: 'MCP_SERVER_NOT_CONNECTED',
          message: 'MCP Server RAG chưa kết nối (chế độ kho tri thức nội bộ)',
          hint: 'Kiểm tra tiến trình mcp-server-rag trong connector.json và log khởi động của mcp-gateway.'
        }
      };
    }
    return {
      step: 'business',
      status: 'passed',
      latencyMs: Date.now() - started,
      detail: {
        server: 'rag',
        mode: 'internal_knowledge_service'
      }
    };
  }
}
