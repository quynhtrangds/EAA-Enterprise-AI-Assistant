export type ToolRiskLevel = 'low' | 'medium' | 'high';

export interface ToolContext {
  userId: string;
  username: string;
  roles: string[];
  sessionId: string;
  requestId: string;
}

export interface McpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  outputSchema?: object;
  riskLevel: ToolRiskLevel;
  readOnly: boolean;
  requiresConfirmation: boolean;
  execute(input: unknown, context: ToolContext): Promise<unknown>;
}

export interface McpConnector {
  name: string;
  listTools(): McpTool[];
}
