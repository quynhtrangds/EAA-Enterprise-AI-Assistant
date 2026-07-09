import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

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

  async listTools(authToken: string): Promise<unknown[]> {
    const response = await fetch(`${env.MCP_GATEWAY_URL}/api/tools`, {
      headers: { authorization: `Bearer ${authToken}` }
    });

    if (!response.ok) {
      throw new AppError('GATEWAY_ERROR', `Gateway list tools failed: ${response.status}`, 502);
    }

    const payload = (await response.json()) as { tools?: unknown[] };
    return payload.tools ?? [];
  }

  async callTool(authToken: string, sessionId: string, toolName: string, args: Record<string, unknown>): Promise<GatewayToolCallResponse> {
    const response = await fetch(`${env.MCP_GATEWAY_URL}/api/tools/call`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        toolName,
        arguments: args,
        sessionId
      })
    });

    const payload = (await response.json()) as GatewayToolCallResponse;
    if (!response.ok) {
      return {
        success: false,
        toolName,
        errorCode: payload.errorCode ?? 'GATEWAY_ERROR',
        message: payload.message ?? `Gateway call failed: ${response.status}`
      };
    }

    return payload;
  }
}
