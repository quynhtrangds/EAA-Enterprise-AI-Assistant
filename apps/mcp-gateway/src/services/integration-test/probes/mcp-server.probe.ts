import type { ProbeStep, ProbeContext, StepResult } from '../probe-step.js';
import { mcpClientManager } from '../../../connectors/mcp-client-manager.js';

export class McpServerProbe implements ProbeStep {
  readonly name = 'mcp-server';

  appliesTo(ctx: ProbeContext): boolean {
    // Applicable if the connector is managed as an MCP server
    return mcpClientManager.isConnected(ctx.integrationCode);
  }

  async run(ctx: ProbeContext): Promise<StepResult> {
    const started = Date.now();
    const serverName = ctx.integrationCode;

    try {
      const isConnected = mcpClientManager.isConnected(serverName);
      if (!isConnected) {
        return {
          step: this.name,
          status: 'failed',
          latencyMs: Date.now() - started,
          error: {
            code: 'MCP_SERVER_NOT_CONNECTED',
            message: `Tiến trình MCP Server "${serverName}" chưa được kết nối`,
            hint: 'Kiểm tra cấu hình connector.json và log khởi động của mcp-gateway.'
          }
        };
      }

      const pingOk = await mcpClientManager.ping(serverName, 3000);
      if (!pingOk) {
        return {
          step: this.name,
          status: 'failed',
          latencyMs: Date.now() - started,
          error: {
            code: 'MCP_SERVER_PING_TIMEOUT',
            message: `Tiến trình MCP Server "${serverName}" không phản hồi lệnh ping (Timeout 3s)`,
            hint: 'Tiến trình con có thể đang bị treo hoặc nghẽn I/O. Thử khởi động lại mcp-gateway.'
          }
        };
      }

      return {
        step: this.name,
        status: 'passed',
        latencyMs: Date.now() - started,
        detail: {
          server: serverName,
          status: 'ready'
        }
      };
    } catch (err: any) {
      return {
        step: this.name,
        status: 'failed',
        latencyMs: Date.now() - started,
        error: {
          code: 'MCP_SERVER_ERROR',
          message: err?.message || 'Lỗi kiểm tra tiến trình MCP Server',
          hint: 'Kiểm tra log của tiến trình MCP Server con.'
        }
      };
    }
  }
}
