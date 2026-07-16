import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

interface GatewayToolCallResponse {
  success: boolean;
  toolName?: string;
  data?: unknown;
  durationMs?: number;
  errorCode?: string;
  message?: string;
}

interface GatewayCurrentUserResponse {
  user: {
    id: string;
    username: string;
    displayName: string;
    roles: string[];
  };
}

export class McpGatewayClient {
  private client: Client | null = null;
  private transport: SSEClientTransport | null = null;
  private isConnected = false;

  async getCurrentUser(authToken: string): Promise<GatewayCurrentUserResponse['user']> {
    const response = await fetch(`${env.MCP_GATEWAY_URL}/api/me`, {
      headers: { authorization: `Bearer ${authToken}` }
    });

    if (!response.ok) {
      throw new AppError('GATEWAY_ERROR', `Gateway current user lookup failed: ${response.status}`, 502);
    }

    const payload = (await response.json()) as GatewayCurrentUserResponse;
    return payload.user;
  }

  async connect(authToken: string) {
    if (this.isConnected) return;
    
    this.transport = new SSEClientTransport(new URL(`${env.MCP_GATEWAY_URL}/api/mcp/sse`), {
      eventSourceInit: {
        headers: { authorization: `Bearer ${authToken}` }
      }
    } as any);
    
    this.client = new Client({ name: "ai-orchestrator", version: "1.0.0" }, { capabilities: {} });
    await this.client.connect(this.transport);
    this.isConnected = true;
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.close();
      this.isConnected = false;
    }
  }

  async listTools(authToken: string): Promise<any[]> {
    await this.connect(authToken);
    const result = await this.client!.listTools();
    // Map MCP SDK tool format to our expected GatewayTool format
    // In our mcp gateway's tools/list handler, we passed inputSchema
    return result.tools.map((t: any) => ({
      name: t.name,
      title: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      permitted: true // Currently hardcoded to true for MCP response
    }));
  }

  async callTool(authToken: string, sessionId: string, toolName: string, args: Record<string, unknown>): Promise<GatewayToolCallResponse> {
    await this.connect(authToken);
    const start = Date.now();
    try {
      const result = await this.client!.callTool({ name: toolName, arguments: args });
      
      if (result.isError) {
        return {
          success: false,
          toolName,
          errorCode: 'TOOL_EXECUTION_ERROR',
          message: (result.content as any)[0]?.text
        };
      }

      return {
        success: true,
        toolName,
        data: JSON.parse((result.content as any)[0]?.text || '{}'),
        durationMs: Date.now() - start
      };
    } catch (error: any) {
      return {
        success: false,
        toolName,
        errorCode: 'GATEWAY_ERROR',
        message: error.message
      };
    }
  }
}
