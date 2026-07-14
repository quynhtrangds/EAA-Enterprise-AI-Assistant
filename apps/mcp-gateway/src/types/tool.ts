import { z } from 'zod';

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
  inputSchema: z.ZodObject<any>;
  outputSchema?: z.ZodObject<any>;
  execute(input: any, context: ToolContext): Promise<any>;
}

export interface McpConnector {
  name: string;
  listTools(): McpTool[];
}
